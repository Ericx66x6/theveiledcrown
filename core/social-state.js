import { clone } from './model.js';
export const socialKinds = ['message', 'reminder', 'poke', 'kudos', 'icebreaker', 'challenge'];
export const gestures = ['rock', 'paper', 'scissors'];
export const socialVisible = (p, a) =>
  !p.hidden_by?.includes(a.id) && !!p.to && (p.to === a.id || p.created_by === a.id);
export function publicSocialPost(post, actor) {
  const p = clone(post);
  if (p.kind === 'challenge' && p.status !== 'completed') {
    p.own_choice = p.choices?.[actor.id] || null;
    delete p.choices;
  }
  return p;
}
export function rpsWinner(a, b) {
  if (a === b) return 'draw';
  return { rock: 'scissors', paper: 'rock', scissors: 'paper' }[a] === b ? 'sender' : 'recipient';
}
