import { ConfettiEngine, type ConfettiWorkerMessage } from './confetti-engine';

const engine = new ConfettiEngine();
const scope = self as unknown as { postMessage(id: number): void; onmessage: ((e: MessageEvent<ConfettiWorkerMessage>) => void) | null };

scope.onmessage = ({ data }) => {
  if ('attach' in data) engine.attach(data.canvas);
  else if ('detach' in data) engine.detach();
  else {
    const { cmd } = data;
    // Report finished bursts by their id
    engine.handle(cmd)?.then(() => { if ('id' in cmd) scope.postMessage(cmd.id); });
  }
};
