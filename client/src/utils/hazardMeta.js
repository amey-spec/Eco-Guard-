import {
  Wind, Droplet, Mountain, Waves, Recycle, Trees, Sun, Flame, FlaskConical, Volume2, Leaf,
} from 'lucide-react';

/**
 * Resolves a hazard category (as returned by the API, e.g. "Air Pollution")
 * to an icon + soft natural tile classes. Pure, static class strings so
 * Tailwind can detect them.
 */
export function getHazardMeta(category = '') {
  const c = String(category).toLowerCase();

  if (c.includes('air')) {
    return { icon: Wind, tile: 'bg-[#e3edf0] text-[#3d6f83]', label: 'Air' };
  }
  if (c.includes('water')) {
    return { icon: Droplet, tile: 'bg-[#e2eff0] text-[#3f7d8a]', label: 'Water' };
  }
  if (c.includes('soil') || c.includes('land')) {
    return { icon: Mountain, tile: 'bg-[#f1e8d8] text-[#8a6434]', label: 'Soil' };
  }
  if (c.includes('noise')) {
    return { icon: Volume2, tile: 'bg-[#ececee] text-[#5f6570]', label: 'Noise' };
  }
  if (c.includes('plastic') || c.includes('waste')) {
    return { icon: Recycle, tile: 'bg-[#efe6ea] text-[#915570]', label: 'Waste' };
  }
  if (c.includes('deforest') || c.includes('forest') || c.includes('habitat')) {
    return { icon: Trees, tile: 'bg-[#e5efe0] text-[#4c7a3e]', label: 'Forest' };
  }
  if (c.includes('flood')) {
    return { icon: Waves, tile: 'bg-[#e0edf0] text-[#37748a]', label: 'Water' };
  }
  if (c.includes('heat') || c.includes('temper')) {
    return { icon: Sun, tile: 'bg-[#fae9d6] text-[#c06a22]', label: 'Heat' };
  }
  if (c.includes('fire') || c.includes('wildfire')) {
    return { icon: Flame, tile: 'bg-[#fae4dc] text-[#b0502f]', label: 'Fire' };
  }
  if (c.includes('chem')) {
    return { icon: FlaskConical, tile: 'bg-[#e7e4ee] text-[#6a5f8a]', label: 'Chemical' };
  }
  return { icon: Leaf, tile: 'bg-[#e5efe2] text-[#44684a]', label: 'Ecological' };
}
