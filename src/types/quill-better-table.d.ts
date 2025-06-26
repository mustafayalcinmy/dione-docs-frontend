declare module 'quill-better-table' {
    class QuillBetterTable {
      constructor(quill: any, options: any);
      insertTable(rows: number, cols: number): void;
    }
    export default QuillBetterTable;
  }