export function thumbnailUrl(imageUrl: string): string {
  return imageUrl.replace(/^\/images\/(recipes|foods)\/([^/]+)\.(?:jpg|jpeg|png|webp)$/i, '/images/thumbnails/$1/$2.webp');
}