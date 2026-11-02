import { describe, expect, it } from 'vitest';
import { thumbnailUrl } from './images';

describe('thumbnailUrl', () => {
  it('uses a small local copy for recipe and food images', () => {
    expect(thumbnailUrl('/images/recipes/sopes-123.jpg')).toBe('/images/thumbnails/recipes/sopes-123.webp');
    expect(thumbnailUrl('/images/foods/calabacita.png')).toBe('/images/thumbnails/foods/calabacita.webp');
  });

  it('preserves external and unsupported image URLs', () => {
    expect(thumbnailUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(thumbnailUrl('/other/photo.jpg')).toBe('/other/photo.jpg');
  });
});