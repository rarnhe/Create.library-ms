declare var WScript: {
  Echo(text: any): void;
  Sleep(ms: number): void;
  Quit(exitCode?: number): void;
  CreateObject(progID: string): any;
  Arguments: {
    length: number;
    Item(index: number): string;
  };
  ScriptFullName: string;
  ScriptName: string;
};

declare class ActiveXObject {
  constructor(progID: string);
  [key: string]: any;
}