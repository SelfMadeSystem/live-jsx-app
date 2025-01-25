import TailwindWorker from "./tailwind.worker?worker";

export class TailwindHandler {
  private worker = new TailwindWorker();
  private previousCss = "";

  public async buildCss(css: string, classes: string[]): Promise<string> {
    if (this.previousCss === css) {
      return this.previousCss;
    }
    return new Promise((resolve) => {
      this.worker.addEventListener("message", (event) => {
        if (event.data.type === "buildCssResult") {
          this.previousCss = event.data.result;
          resolve(event.data.result);
        }
      });
      this.worker.postMessage({
        type: "buildCss",
        css,
        classes,
      });
    });
  }

  public async buildClasses(classes: string[]): Promise<string> {
    return new Promise((resolve) => {
      this.worker.addEventListener("message", (event) => {
        if (event.data.type === "buildClassesResult") {
          resolve(event.data.result);
        }
      });
      this.worker.postMessage({
        type: "buildClasses",
        classes,
      });
    });
  }
}
