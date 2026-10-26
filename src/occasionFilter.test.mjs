import assert from 'node:assert/strict';
import { EVENT_OCCASIONS, filterOutfitsByOccasion } from './occasionFilter.js';

const items = [
  { id: 'dress', name: 'Satin Dress' },
  { id: 'suit', name: 'Tailored Suit' },
  { id: 'shirt', name: 'Poplin Shirt' },
];
const looks = [
  { id: 'w', name: 'Wedding Guest', occasion: 'Wedding', audience: 'Women', items: ['dress'] },
  { id: 'f', name: 'Black Tie', occasion: 'Formal', audience: 'Men', items: ['suit'] },
  { id: 'd', name: 'Dinner Before Eight', occasion: 'Date Night', audience: 'Women', items: ['dress'] },
  { id: 'p', name: 'After Hours', occasion: 'Party', audience: 'Everyone', items: ['shirt'] },
  { id: 'fe', name: 'Festive, Reconsidered', occasion: 'Festive', audience: 'Women', items: ['dress', 'shirt'] },
  { id: 'g', name: 'The Graduation Edit', occasion: 'Graduation', audience: 'Everyone', items: ['suit', 'shirt'] },
  { id: 'e', name: 'Everyday Uniform', occasion: 'Everyday', audience: 'Everyone', items: ['shirt'] },
];

assert.deepEqual(filterOutfitsByOccasion(looks, 'Wedding', { items }).map(x => x.id), ['w']);
assert.deepEqual(filterOutfitsByOccasion(looks, ' wedding ', { items }).map(x => x.id), ['w']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'black tie', { items }).map(x => x.id), ['f']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'All occasions', { eventOnly: true, items }).map(x => x.id), ['w', 'f', 'd', 'p', 'fe', 'g']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'Date Night', { audience: 'Men', items }).map(x => x.id), []);
assert.deepEqual(filterOutfitsByOccasion(looks, 'Date Night', { audience: 'Women', items }).map(x => x.id), ['d']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'Party', { search: 'shirt', items }).map(x => x.id), ['p']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'Festive', { items }).map(x => x.id), ['fe']);
assert.deepEqual(filterOutfitsByOccasion(looks, 'Graduation', { items }).map(x => x.id), ['g']);
assert.equal(EVENT_OCCASIONS.length, 6);
console.log('PASS: 10 occasion filtering assertions passed.');
