import { categoryValues } from '../models/Task.js';

export const STREAK_MILESTONES = [
  { days: 3, rewardXp: 30, id: 'streak-starter', label: 'Streak Starter' },
  { days: 7, rewardXp: 70, id: 'unstoppable', label: 'Unstoppable' },
  { days: 14, rewardXp: 140, id: 'fortnight-fury', label: 'Fortnight Fury' },
  { days: 30, rewardXp: 300, id: 'marathon', label: 'Marathon' },
  { days: 60, rewardXp: 600, id: 'iron-will', label: 'Iron Will' },
  { days: 100, rewardXp: 1000, id: 'streak-centennial', label: 'Streak Centennial' }
];

export function buildAchievements(user, categoriesCompleted, level) {
  const streakAchievements = STREAK_MILESTONES.map((milestone) => ({
    id: milestone.id,
    label: milestone.label,
    description: `Reach a ${milestone.days} day login streak (+${milestone.rewardXp} bonus XP).`,
    icon: 'local_fire_department',
    target: milestone.days,
    progress: user.streak,
    rewardXp: milestone.rewardXp
  }));

  const defs = [
    {
      id: 'first-blood',
      label: 'First Blood',
      description: 'Complete your first quest.',
      icon: 'swords',
      target: 1,
      progress: user.completedQuestsCount
    },
    {
      id: 'getting-started',
      label: 'Getting Started',
      description: 'Complete 5 quests.',
      icon: 'task_alt',
      target: 5,
      progress: user.completedQuestsCount
    },
    {
      id: 'centurion',
      label: 'Centurion',
      description: 'Complete 25 quests.',
      icon: 'shield',
      target: 25,
      progress: user.completedQuestsCount
    },
    {
      id: 'legend',
      label: 'Legend',
      description: 'Complete 100 quests.',
      icon: 'trophy',
      target: 100,
      progress: user.completedQuestsCount
    },
    ...streakAchievements,
    {
      id: 'rising-hero',
      label: 'Rising Hero',
      description: 'Reach level 5.',
      icon: 'star',
      target: 5,
      progress: level
    },
    {
      id: 'veteran',
      label: 'Veteran',
      description: 'Reach level 10.',
      icon: 'star',
      target: 10,
      progress: level
    },
    {
      id: 'jack-of-all-trades',
      label: 'Jack of All Trades',
      description: 'Complete a quest in every category.',
      icon: 'layers',
      target: categoryValues.length,
      progress: categoriesCompleted
    },
    {
      id: 'guild-member',
      label: 'Guild Member',
      description: 'Join a guild.',
      icon: 'group',
      target: 1,
      progress: user.group ? 1 : 0
    },
    {
      id: 'frost-shield',
      label: 'Frost Shield',
      description: 'Stockpile 3 streak freezes.',
      icon: 'ac_unit',
      target: 3,
      progress: user.freezesAvailable
    }
  ];

  return defs.map((def) => {
    const progress = Math.min(def.progress, def.target);
    return { ...def, progress, earned: progress >= def.target };
  });
}
