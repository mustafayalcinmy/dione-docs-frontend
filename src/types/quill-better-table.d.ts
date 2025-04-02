// src/types/quill-better-table.d.ts
declare module 'quill-better-table' {
    // You can add more specific types here if you know them,
    // but this basic declaration is often enough to remove the error.
    // For example, you might know the constructor and insertTable method:
    class QuillBetterTable {
      constructor(quill: any, options: any);
      insertTable(rows: number, cols: number): void;
      // Add other methods you use if known
    }
    export default QuillBetterTable;
  
    // Alternatively, if you only need to declare the module exists:
    // const QuillBetterTable: any;
    // export default QuillBetterTable;
  }