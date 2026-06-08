declare module 'jpeg-js' {
  export interface DecodeOptions {
    useTArray?: boolean;
    maxMemoryUsageInMB?: number;
    maxResolutionInMP?: number;
    formatAsRGBA?: boolean;
  }

  export interface DecodedImage {
    width: number;
    height: number;
    data: Uint8Array;
  }

  const jpeg: {
    decode(data: Uint8Array, options?: DecodeOptions): DecodedImage;
  };

  export default jpeg;
}
