// Drop-in fake for `new WebSocket(url)` for demo
export class FakeWebSocket {
  onmessage: ((event: { data: string }) => void) | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(url: string) {
    this.interval = setInterval(() => {
      this.onmessage?.({ data: new Date().toLocaleTimeString() });
    }, 1000);
  }

  close(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
