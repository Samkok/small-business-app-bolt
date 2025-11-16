export interface FileValidationOptions {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedName?: string;
}

const defaultImageOptions: FileValidationOptions = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
};

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .substring(0, 255);
}

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.substring(lastDot).toLowerCase();
}

export function validateFileSize(size: number, maxSize: number): FileValidationResult {
  if (size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }
  return { isValid: true };
}

export function validateFileType(
  fileName: string,
  mimeType: string,
  options: FileValidationOptions
): FileValidationResult {
  const extension = getFileExtension(fileName);

  if (!options.allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${options.allowedExtensions.join(', ')}`,
    };
  }

  if (!options.allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid file format. Expected: ${options.allowedMimeTypes.join(', ')}`,
    };
  }

  return { isValid: true };
}

export function validateFileName(fileName: string): FileValidationResult {
  if (!fileName || fileName.trim().length === 0) {
    return {
      isValid: false,
      error: 'File name is required',
    };
  }

  if (fileName.length > 255) {
    return {
      isValid: false,
      error: 'File name is too long (maximum 255 characters)',
    };
  }

  if (/[<>:"|?*\x00-\x1f]/.test(fileName)) {
    return {
      isValid: false,
      error: 'File name contains invalid characters',
    };
  }

  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(fileName)) {
    return {
      isValid: false,
      error: 'File name is reserved by system',
    };
  }

  if (fileName.startsWith('.') || fileName.endsWith('.')) {
    return {
      isValid: false,
      error: 'File name cannot start or end with a period',
    };
  }

  return {
    isValid: true,
    sanitizedName: sanitizeFileName(fileName),
  };
}

export function validateImageFile(
  file: { uri: string; type: string; name: string } | File,
  options: Partial<FileValidationOptions> = {}
): FileValidationResult {
  const validationOptions = { ...defaultImageOptions, ...options };

  let fileName: string;
  let mimeType: string;
  let fileSize: number;

  if ('size' in file) {
    const webFile = file as File;
    fileName = webFile.name;
    mimeType = webFile.type;
    fileSize = webFile.size;
  } else {
    const mobileFile = file as { uri: string; type: string; name: string };
    fileName = mobileFile.name;
    mimeType = mobileFile.type;
    fileSize = 0;
  }

  const nameValidation = validateFileName(fileName);
  if (!nameValidation.isValid) {
    return nameValidation;
  }

  const typeValidation = validateFileType(fileName, mimeType, validationOptions);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  if (fileSize > 0) {
    const sizeValidation = validateFileSize(fileSize, validationOptions.maxSizeBytes);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }
  }

  return {
    isValid: true,
    sanitizedName: nameValidation.sanitizedName,
  };
}

export function detectMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

export function generateSecureFileName(originalName: string, prefix?: string): string {
  const extension = getFileExtension(originalName);
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);

  const baseName = prefix ? `${prefix}_${timestamp}_${randomString}` : `${timestamp}_${randomString}`;

  return `${baseName}${extension}`;
}

export function validateImageDimensions(
  width: number,
  height: number,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
    aspectRatio?: number;
  } = {}
): FileValidationResult {
  if (options.maxWidth && width > options.maxWidth) {
    return {
      isValid: false,
      error: `Image width exceeds maximum of ${options.maxWidth}px`,
    };
  }

  if (options.maxHeight && height > options.maxHeight) {
    return {
      isValid: false,
      error: `Image height exceeds maximum of ${options.maxHeight}px`,
    };
  }

  if (options.minWidth && width < options.minWidth) {
    return {
      isValid: false,
      error: `Image width must be at least ${options.minWidth}px`,
    };
  }

  if (options.minHeight && height < options.minHeight) {
    return {
      isValid: false,
      error: `Image height must be at least ${options.minHeight}px`,
    };
  }

  if (options.aspectRatio) {
    const actualRatio = width / height;
    const tolerance = 0.1;
    if (Math.abs(actualRatio - options.aspectRatio) > tolerance) {
      return {
        isValid: false,
        error: `Image aspect ratio must be approximately ${options.aspectRatio}:1`,
      };
    }
  }

  return { isValid: true };
}
