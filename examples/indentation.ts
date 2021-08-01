export class Indentation {

  public run(js: string) {
    let i = 0;
    for (const l of js.split("\n")) {
      if (l.startsWith("}")) {
        i = i - 1;
      }
      if (l.endsWith(" {")) {
        i = i + 1;
      }
    }
  }

}