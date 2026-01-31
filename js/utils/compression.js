/* ==========================================================================
   LINKPAD - COMPRESSION UTILITIES
   Uses native CompressionStream API for browser-native Gzip compression
   ========================================================================== */

/**
 * Compress a text string using Gzip and encode as Base64
 * @param {string} text - The text to compress
 * @returns {Promise<string>} - Base64 encoded compressed data
 */
export async function compress(text) {
  if (!text) return '';

  try {
    // Convert string to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Create compression stream
    const stream = new Blob([data])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));

    // Read compressed data
    const compressedBlob = await new Response(stream).blob();
    const compressedBuffer = await compressedBlob.arrayBuffer();
    const compressedBytes = new Uint8Array(compressedBuffer);

    // Convert to Base64 (URL-safe)
    const base64 = arrayBufferToBase64(compressedBytes);

    // Make URL-safe by replacing characters
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error('Compression failed:', error);
    throw new Error('Failed to compress content');
  }
}

/**
 * Decompress a Base64-encoded Gzip string
 * @param {string} base64 - Base64 encoded compressed data
 * @returns {Promise<string>} - The decompressed text
 */
export async function decompress(base64) {
  if (!base64) return '';

  try {
    // Restore URL-safe Base64 to standard Base64
    let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (standardBase64.length % 4) {
      standardBase64 += '=';
    }

    // Convert Base64 to bytes
    const compressedBytes = base64ToArrayBuffer(standardBase64);

    // Create decompression stream
    const stream = new Blob([compressedBytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));

    // Read decompressed data
    const decompressedText = await new Response(stream).text();

    return decompressedText;
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new Error('Failed to decompress content');
  }
}

/**
 * Convert Uint8Array to Base64 string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function arrayBufferToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if CompressionStream API is supported
 * @returns {boolean}
 */
export function isCompressionSupported() {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof DecompressionStream !== 'undefined'
  );
}
