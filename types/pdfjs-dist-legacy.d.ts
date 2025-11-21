declare module "pdfjs-dist/legacy/build/pdf.js" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: {
    data: Uint8Array;
    disableWorker?: boolean;
  }): {
    promise: Promise<{
      getPage: (
        n: number
      ) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str: string }>;
        }>;
      }>;
    }>;
  };
}
