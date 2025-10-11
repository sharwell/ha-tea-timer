import type { ReactiveController, ReactiveControllerHost } from "lit";

export class TestHost implements ReactiveControllerHost {
  private controllers: ReactiveController[] = [];

  public addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }

  public removeController(controller: ReactiveController): void {
    this.controllers = this.controllers.filter((item) => item !== controller);
  }

  public requestUpdate(): void {
    // no-op for tests
  }

  public get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
