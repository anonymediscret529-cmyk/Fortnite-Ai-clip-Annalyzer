export const captureFrame = (videoElement: HTMLVideoElement): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  // Return base64 string without the prefix for Gemini
  // Reduced quality to 0.5 for faster speed
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  return dataUrl.split(',')[1];
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const cleanUrl = url.trim();
  
  // Regex to handle various formats including shorts, mobile, standard
  // The second group [^#&?\/]* stops capturing at #, &, ?, or / (trailing slash)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?\/]*).*/;
  
  const match = cleanUrl.match(regExp);
  
  if (match && match[2]) {
     const id = match[2];
     // YouTube IDs are strictly 11 characters
     return id.length === 11 ? id : null;
  }
  return null;
};

export const getYoutubeThumbnailBase64 = async (videoId: string): Promise<string> => {
  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });

  try {
    // Try high-res thumbnail first
    const img = await loadImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");
    ctx.drawImage(img, 0, 0);
    // Reduced quality to 0.5 for faster speed
    return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
  } catch (e) {
    try {
      // Fallback to standard quality
      const img = await loadImage(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    } catch (finalError) {
      throw new Error("Could not capture YouTube thumbnail for analysis. CORS or Invalid ID.");
    }
  }
};

export const sampleVideoFrames = async (video: HTMLVideoElement, numFrames = 5): Promise<{data: string, timestamp: number}[]> => {
  const duration = video.duration;
  if (!duration || duration === Infinity) return [];
  
  const frames: {data: string, timestamp: number}[] = [];
  const originalTime = video.currentTime;
  const wasPlaying = !video.paused;
  
  video.pause();
  
  // Create intervals (skip start and very end)
  const interval = duration / (numFrames + 1);
  
  try {
    for (let i = 1; i <= numFrames; i++) {
      const time = interval * i;
      video.currentTime = time;
      
      // Wait for seek
      await new Promise<void>((resolve) => {
        const handler = () => {
          video.removeEventListener('seeked', handler);
          resolve();
        };
        video.addEventListener('seeked', handler);
      });
      
      const frameData = captureFrame(video);
      if (frameData) {
        frames.push({ data: frameData, timestamp: time });
      }
    }
  } catch (e) {
    console.error("Frame sampling error", e);
  } finally {
    // Restore state
    video.currentTime = originalTime;
    // We leave it paused for better UX after analysis
  }
  
  return frames;
};