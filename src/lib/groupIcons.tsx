import {
  Globe, Home, Plane, Utensils, PartyPopper, Briefcase,
  GraduationCap, Car, Dumbbell, ShoppingCart, Music, Coffee,
  Heart, Gamepad2, Tent, Waves, Bike, Mountain, Film, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface GroupIconDef {
  name:  string;
  label: string;
  Icon:  LucideIcon;
}

export const GROUP_ICON_DEFS: GroupIconDef[] = [
  { name: 'Globe',         label: 'Travel',    Icon: Globe         },
  { name: 'Home',          label: 'Home',      Icon: Home          },
  { name: 'Plane',         label: 'Flight',    Icon: Plane         },
  { name: 'Utensils',      label: 'Food',      Icon: Utensils      },
  { name: 'PartyPopper',   label: 'Party',     Icon: PartyPopper   },
  { name: 'Briefcase',     label: 'Work',      Icon: Briefcase     },
  { name: 'GraduationCap', label: 'School',    Icon: GraduationCap },
  { name: 'Car',           label: 'Road trip', Icon: Car           },
  { name: 'Dumbbell',      label: 'Fitness',   Icon: Dumbbell      },
  { name: 'ShoppingCart',  label: 'Shopping',  Icon: ShoppingCart  },
  { name: 'Music',         label: 'Music',     Icon: Music         },
  { name: 'Coffee',        label: 'Hangout',   Icon: Coffee        },
  { name: 'Heart',         label: 'Family',    Icon: Heart         },
  { name: 'Gamepad2',      label: 'Gaming',    Icon: Gamepad2      },
  { name: 'Tent',          label: 'Camping',   Icon: Tent          },
  { name: 'Waves',         label: 'Beach',     Icon: Waves         },
  { name: 'Bike',          label: 'Cycling',   Icon: Bike          },
  { name: 'Mountain',      label: 'Hiking',    Icon: Mountain      },
  { name: 'Film',          label: 'Movies',    Icon: Film          },
  { name: 'Users',         label: 'General',   Icon: Users         },
];

const ICON_MAP = new Map<string, LucideIcon>(
  GROUP_ICON_DEFS.map(d => [d.name, d.Icon])
);

interface GroupIconDisplayProps {
  icon?:      string | null;
  size?:      number;
  className?: string;
}

/** Renders either a Lucide icon (by name) or a custom uploaded image (data URL). */
export function GroupIconDisplay({ icon, size = 14, className = '' }: GroupIconDisplayProps) {
  if (!icon) return null;

  if (icon.startsWith('data:')) {
    return (
      <img
        src={icon}
        alt=""
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const Icon = ICON_MAP.get(icon);
  if (!Icon) return null;
  return <Icon size={size} className={`shrink-0 ${className}`} />;
}
