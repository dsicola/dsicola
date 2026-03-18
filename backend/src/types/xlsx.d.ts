declare module 'xlsx' {
  const xlsx: {
    read: (data: Buffer | string, opts?: { type?: string; cellDates?: boolean; cellStyles?: boolean; cellNF?: boolean }) => any;
    write: (workbook: any, opts?: { type?: string; bookType?: string }) => any;
    utils: {
      decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
      encode_cell: (cell: { r: number; c: number }) => string;
    };
  };
  export = xlsx;
}
