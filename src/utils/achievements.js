import { categoryValues } from '../models/Task.js';

export function buildAchievements(user, categoriesCompleted, level) {
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
    {
      id: 'streak-starter',
      label: 'Streak Starter',
      description: 'Reach a 3 day login streak.',
      icon: 'local_fire_department',
      target: 3,
      progress: user.streak
    },
    {
      id: 'unstoppable',
      label: 'Unstoppable',
      description: 'Reach a 7 day login streak.',
      icon: 'local_fire_department',
      target: 7,
      progress: user.streak
    },
    {
      id: 'marathon',
      label: 'Marathon',
      description: 'Reach a 30 day login streak.',
      icon: 'local_fire_department',
      target: 30,
      progress: user.streak
    },
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
