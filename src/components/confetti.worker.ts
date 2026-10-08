import { ConfettiEngine, type ConfettiWorkerMessage, type ConfettiWorkerReply } from './confetti-engine';

const engine = new ConfettiEngine();
const scope = self as unknown as { postMessage(reply: ConfettiWorkerReply): void; onmessage: ((e: MessageEvent<ConfettiWorkerMessage>) => void) | null };
engine.onRunning = (running) => scope.postMessage({ running });

scope.onmessage = ({ data }) => {
  if ('attach' in data) engine.attach(data.canvas);
  else if ('detach' in data) engine.detach();
  else {
    const { cmd } = data;
    // Report finished bursts by their id
    engine.handle(cmd)?.then(() => { if ('id' in cmd) scope.postMessage({ done: cmd.id }); });
  }
};
