import { RequestHandler } from "express";
import Playlist from "../models/playlist.model";
import Video from "../models/video.model";

// Получить все плейлисты
export const getPlaylists: RequestHandler = async (_req, res) => {
  try {
    const playlists = await Playlist.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json(playlists);
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при получении плейлистов", error });
  }
};

// Получить один плейлист по ID
export const getPlaylistById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      res.status(404).json({ message: "Плейлист не найден" });
      return;
    }
    
    res.status(200).json(playlist);
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при получении плейлиста", error });
  }
};

// Получить видео в плейлисте
export const getPlaylistVideos: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const videos = await Video.find({ playlistId: id }).sort({ order: 1, createdAt: -1 });
    res.status(200).json(videos);
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при получении видео плейлиста", error });
  }
};

// Создать плейлист
export const createPlaylist: RequestHandler = async (req, res) => {
  try {
    const { name, description, order } = req.body;
    
    if (!name) {
      res.status(400).json({ message: "Название плейлиста обязательно" });
      return;
    }
    
    const playlist = new Playlist({ name, description, order });
    const savedPlaylist = await playlist.save();
    
    res.status(201).json(savedPlaylist);
  } catch (error: any) {
    res.status(400).json({ message: "Ошибка при создании плейлиста", error });
  }
};

// Обновить плейлист
export const updatePlaylist: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, order } = req.body;
    
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      res.status(404).json({ message: "Плейлист не найден" });
      return;
    }
    
    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (order !== undefined) playlist.order = order;
    
    const updatedPlaylist = await playlist.save();
    
    res.status(200).json({
      message: "Плейлист успешно обновлен",
      playlist: updatedPlaylist
    });
  } catch (error: any) {
    res.status(400).json({ message: "Ошибка при обновлении плейлиста", error });
  }
};

// Удалить плейлист
export const deletePlaylist: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      res.status(404).json({ message: "Плейлист не найден" });
      return;
    }
    
    // Проверяем, есть ли видео в этом плейлисте
    const videosCount = await Video.countDocuments({ playlistId: id });
    
    if (videosCount > 0) {
      res.status(400).json({ 
        message: `Невозможно удалить плейлист. В нем содержится ${videosCount} видео. Сначала переместите или удалите все видео.`,
        videosCount 
      });
      return;
    }
    
    await playlist.deleteOne();
    res.status(200).json({ message: "Плейлист удален" });
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при удалении плейлиста", error });
  }
};

