import { statSync } from "fs";

export const isWithExtension = (filename: string, extensions: string[]) => {
  const last = filename.split("/").pop();

  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];

    if (last.endsWith(extension)) {
      return true;
    }
  }

  return false;
};

export const completeAbsolutePathWithExtention = (
  absolutePath: string,
  extensions: string[]
) => {
  if (isWithExtension(absolutePath, extensions)) {
    return absolutePath;
  }

  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];

    try {
      const res = absolutePath + ext;

      statSync(res);

      return res;
    } catch (error) {}
  }

  throw new Error(`No extentsion found valid for ${absolutePath}`);
};

export const removeExtension = (filename: string, extensions: string[]) => {
  if (!isWithExtension(filename, extensions)) return filename;

  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];

    if (filename.endsWith(extension)) {
      return filename
        .split("/")
        .pop()
        .replace(new RegExp(`${extension}$`), "");
    }
  }
};
