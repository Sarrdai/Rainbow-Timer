import { env, type Particle } from './model';
import { Loop, sizeCanvas, type Renderer } from './loop';
import { buildAtlas } from './sprites';

/** Sprites stay sharp up to 2x on the GPU */
const MAX_DPR = 2;
const CAP = 2048;
/** Floats per particle: six vec4 attributes */
const STRIDE = 24;

const VS = `
precision highp float;
attribute vec2 a_corner;
attribute vec4 a_p, a_t, a_r, a_s, a_d, a_c;
uniform float u_time, u_dissolveAt, u_sweepAt, u_rainCut, u_dark, u_reduced;
// Shared with the fragment shader, so both must declare the same precision
uniform mediump float u_halo;
uniform vec2 u_view, u_sweep;
varying vec2 v_uv; varying vec3 v_col; varying float v_alpha, v_back;
void main() {
  float tau = u_time - a_t.x;
  float flags = a_s.w;
  float burnable = mod(flags, 2.0);
  float glow = mod(floor(flags / 2.0), 2.0);
  float rain = floor(flags / 4.0);
  if (tau < 0.0 || tau > a_t.y || (rain > 0.5 && a_t.x > u_rainCut) || (u_halo > 0.5 && glow * u_dark < 0.5)) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0); return;
  }
  float k = a_t.z, vt = a_t.w;
  float e = exp(-k * tau), om = (1.0 - e) / k;
  vec2 pos = a_p.xy + vec2(a_p.z * om, vt * tau + (a_p.w - vt) * om);
  pos.x += a_s.x * sin(a_s.y * tau + a_s.z) * (1.0 - e);
  float fadeIn = mix(0.08, 0.25, u_reduced), fadeOut = mix(0.4, 0.5, u_reduced);
  float alpha = clamp(tau / fadeIn, 0.0, 1.0) * clamp((a_t.y - tau) / fadeOut, 0.0, 1.0);
  alpha *= clamp((u_view.y * 1.02 - pos.y) / (u_view.y * 0.2), 0.0, 1.0);
  if (burnable < 0.5 && a_t.x < u_dissolveAt) alpha *= clamp(1.0 - (u_time - u_dissolveAt) / 0.6, 0.0, 1.0);
  if (burnable > 0.5 && a_t.x < u_sweepAt && u_time > u_sweepAt) {
    float ds = u_time - u_sweepAt;
    vec2 d = pos - u_sweep;
    pos += d / max(length(d), 1.0) * 1600.0 * ds * ds + vec2(0.0, 700.0 * ds * ds);
    alpha *= clamp(1.0 - ds / 0.6, 0.0, 1.0);
  }
  float fl = cos(a_r.z + a_r.w * tau);
  vec2 c; float cell;
  if (u_halo > 0.5) {
    c = a_corner * max(a_d.x, a_d.y) * 3.4;
    cell = 5.0;
    alpha *= 0.5 * (0.7 + 0.3 * sin(tau * 5.0 + a_s.z)) * (0.6 + 0.4 * abs(fl));
  } else {
    c = a_corner * a_d.xy;
    c.y *= fl;
    float rot = a_r.x + a_r.y * tau, cs = cos(rot), sn = sin(rot);
    c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
    cell = a_d.z;
  }
  pos += c;
  v_uv = vec2((cell + a_corner.x + 0.5) / 8.0, a_corner.y + 0.5);
  v_col = u_dark > 0.5 ? mix(a_c.rgb, vec3(1.0), 0.14) : a_c.rgb;
  v_alpha = alpha;
  v_back = fl < 0.0 ? 1.0 : 0.0;
  vec2 clip = pos / u_view * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D u_atlas;
uniform mediump float u_halo;
varying vec2 v_uv; varying vec3 v_col; varying float v_alpha, v_back;
void main() {
  // Slight negative LOD bias: the small sprites stay crisp instead of sampling a blurry mip level
  vec4 s = texture2D(u_atlas, v_uv, -0.5);
  float a = s.a * v_alpha;
  if (u_halo > 0.5) { gl_FragColor = vec4(v_col * a, 0.0); return; }
  float shade = s.r * mix(1.0, 0.74, v_back);
  float hl = s.g * mix(1.0, 0.15, v_back);
  gl_FragColor = vec4(mix(v_col * shade, vec3(1.0), hl) * a, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

/** WebGL renderer: instanced quads, the trajectory is evaluated in the vertex shader */
export class GLRenderer implements Renderer {
  private gl: WebGLRenderingContext;
  private ext: ANGLE_instanced_arrays;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private data = new Float32Array(CAP * STRIDE);
  private buf: WebGLBuffer;
  private next = 0;
  private count = 0;
  private loop: Loop;

  /** Returns null without (hardware) WebGL; software WebGL is slower than the 2D path and refused */
  static create(canvas: HTMLCanvasElement, busy: () => boolean): GLRenderer | null {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
    } catch { /* fall through */ }
    const ext = gl?.getExtension('ANGLE_instanced_arrays');
    if (!gl || !ext) return null;
    try {
      return new GLRenderer(canvas, gl, ext, busy);
    } catch {
      return null;
    }
  }

  private constructor(private canvas: HTMLCanvasElement, gl: WebGLRenderingContext, ext: ANGLE_instanced_arrays, busy: () => boolean) {
    this.gl = gl;
    this.ext = ext;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);
    for (const n of ['u_time', 'u_dissolveAt', 'u_sweepAt', 'u_rainCut', 'u_dark', 'u_halo', 'u_reduced', 'u_view', 'u_sweep', 'u_atlas']) this.u[n] = gl.getUniformLocation(prog, n);

    const corner = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const aCorner = gl.getAttribLocation(prog, 'a_corner');
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    ['a_p', 'a_t', 'a_r', 'a_s', 'a_d', 'a_c'].forEach((n, i) => {
      const loc = gl.getAttribLocation(prog, n);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      ext.vertexAttribDivisorANGLE(loc, 1);
    });

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u.u_atlas, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.loop = new Loop((t) => this.frame(t), () => this.release(), busy);
  }

  add(list: Particle[]) {
    const { data } = this;
    const first = this.next;
    let until = 0;
    for (const p of list) {
      data.set([p.x, p.y, p.vx, p.vy, p.t0, p.life, p.k, p.vt, p.rot0, p.spin, p.flip0, p.flip, p.amp, p.freq, p.phase, p.flags, p.w, p.h, p.shape, 0, p.rgb[0], p.rgb[1], p.rgb[2], 1], (this.next % CAP) * STRIDE);
      until = Math.max(until, p.t0 + p.life);
      this.next++;
    }
    this.count = Math.min(CAP, this.next);
    // Upload the written slots (two ranges when the ring wraps)
    const { gl } = this;
    const a = first % CAP;
    const n = list.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (n >= CAP) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    else if (a + n <= CAP) gl.bufferSubData(gl.ARRAY_BUFFER, a * STRIDE * 4, data.subarray(a * STRIDE, (a + n) * STRIDE));
    else {
      gl.bufferSubData(gl.ARRAY_BUFFER, a * STRIDE * 4, data.subarray(a * STRIDE));
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, (a + n - CAP) * STRIDE));
    }
    this.loop.extend(until);
  }

  extendTo(t: number) { this.loop.extend(t); }

  private frame(t: number) {
    const { gl, u, canvas } = this;
    if (gl.isContextLost()) return;
    const dpr = sizeCanvas(canvas, MAX_DPR, env.w, env.h);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.u_time, t);
    gl.uniform1f(u.u_dissolveAt, env.dissolveAt);
    gl.uniform1f(u.u_sweepAt, env.sweepAt);
    gl.uniform1f(u.u_rainCut, env.rainCut);
    gl.uniform1f(u.u_dark, env.dark ? 1 : 0);
    gl.uniform1f(u.u_reduced, env.reduced ? 1 : 0);
    gl.uniform2f(u.u_view, canvas.width / dpr, canvas.height / dpr);
    gl.uniform2f(u.u_sweep, env.sweepX, env.sweepY);
    if (env.dark) {
      gl.uniform1f(u.u_halo, 1);
      this.ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
    gl.uniform1f(u.u_halo, 0);
    this.ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, this.count);
  }

  /** Idle: drop the full-window drawing buffer until the next burst */
  private release() {
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.next = 0;
    this.count = 0;
  }

  destroy() {
    this.loop.stop();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
