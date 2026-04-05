import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import Post, { IPostAttachment, PostAttachmentKind } from "../models/post.model";

const uploadsDir = path.join(process.cwd(), "uploads");
const postsDir = path.join(uploadsDir, "posts");

function ensurePostsDir(): void {
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function detectAttachmentKind(mimeType: string): PostAttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function deleteLocalAttachment(filename?: string): void {
  if (!filename) return;

  const filePath = path.join(postsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function parseExistingAttachments(rawValue: unknown): IPostAttachment[] {
  if (!rawValue || typeof rawValue !== "string") return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object" && typeof item.filename === "string")
      .map((item) => ({
        filename: String(item.filename),
        originalName: String(item.originalName || item.filename),
        mimeType: String(item.mimeType || "application/octet-stream"),
        size: Number(item.size || 0),
        kind: detectAttachmentKind(String(item.mimeType || "application/octet-stream"))
      }));
  } catch {
    return [];
  }
}

function buildNewAttachments(files: Express.Multer.File[] = []): IPostAttachment[] {
  ensurePostsDir();

  return files.map((file) => {
    const uniqueName = `post_${Date.now()}_${Math.round(Math.random() * 1e9)}_${sanitizeName(file.originalname)}`;
    fs.writeFileSync(path.join(postsDir, uniqueName), file.buffer);

    return {
      filename: uniqueName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind: detectAttachmentKind(file.mimetype)
    };
  });
}

export const getPosts: RequestHandler = async (_req, res) => {
  try {
    const posts = await Post.find().sort({ isPinned: -1, publishedAt: -1, createdAt: -1 });
    res.status(200).json(posts);
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при получении постов", error: error?.message || String(error) });
  }
};

export const createPost: RequestHandler = async (req, res) => {
  try {
    const { title = "", content = "", isPinned = "false" } = req.body as Record<string, string>;
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const attachments = buildNewAttachments(uploadedFiles);

    if (!title.trim() && !content.trim() && attachments.length === 0) {
      res.status(400).json({ message: "Добавьте текст, заголовок или хотя бы одно вложение" });
      return;
    }

    const post = new Post({
      title: title.trim(),
      content: content.trim(),
      attachments,
      isPinned: String(isPinned) === "true",
      publishedAt: new Date()
    });

    const savedPost = await post.save();
    res.status(201).json(savedPost);
  } catch (error: any) {
    console.error("Ошибка при создании поста:", error);
    res.status(400).json({ message: "Ошибка при создании поста", error: error?.message || String(error) });
  }
};

export const updatePost: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const foundPost = await Post.findById(id);

    if (!foundPost) {
      res.status(404).json({ message: "Пост не найден" });
      return;
    }

    const { title = "", content = "", isPinned = "false" } = req.body as Record<string, string>;
    const keptAttachments = parseExistingAttachments(req.body.existingAttachments);
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const newAttachments = buildNewAttachments(uploadedFiles);
    const nextAttachments = [...keptAttachments, ...newAttachments];

    if (!title.trim() && !content.trim() && nextAttachments.length === 0) {
      res.status(400).json({ message: "Добавьте текст, заголовок или хотя бы одно вложение" });
      return;
    }

    const keptFilenames = new Set(keptAttachments.map((attachment) => attachment.filename));
    foundPost.attachments.forEach((attachment) => {
      if (!keptFilenames.has(attachment.filename)) {
        deleteLocalAttachment(attachment.filename);
      }
    });

    foundPost.title = title.trim();
    foundPost.content = content.trim();
    foundPost.isPinned = String(isPinned) === "true";
    foundPost.attachments = nextAttachments;

    await foundPost.save();

    res.status(200).json({
      message: "Пост успешно обновлен",
      post: foundPost
    });
  } catch (error: any) {
    console.error("Ошибка при обновлении поста:", error);
    res.status(500).json({ message: "Ошибка при обновлении поста", error: error?.message || String(error) });
  }
};

export const deletePost: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const foundPost = await Post.findById(id);

    if (!foundPost) {
      res.status(404).json({ message: "Пост не найден" });
      return;
    }

    foundPost.attachments.forEach((attachment) => deleteLocalAttachment(attachment.filename));
    await foundPost.deleteOne();

    res.status(200).json({ message: "Пост удален" });
  } catch (error: any) {
    console.error("Ошибка при удалении поста:", error);
    res.status(500).json({ message: "Ошибка при удалении поста", error: error?.message || String(error) });
  }
};
