import test from 'node:test';
import assert from 'node:assert/strict';
import {prefs} from '../src/lib/preferences.ts';

test('public and portal preferences preserve the existing storage keys', () => {
 const values = new Map();
 const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
 Object.defineProperty(globalThis, 'localStorage', {configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
 try {
  assert.equal(prefs.getDarkMode(),true);
  prefs.saveDarkMode(false);
  assert.equal(values.get('shooter_red_identity_mode'),'false');
  assert.equal(prefs.getDarkMode(),false);
  prefs.saveDarkMode(true);
  assert.equal(prefs.getDarkMode(),true);
  prefs.saveLang('en'); assert.equal(values.get('shooter_lang'),'en');assert.equal(prefs.getLang(),'en');
 } finally {if(previous) Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
test('unavailable browser storage does not prevent theme changes', () => {
 const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked');}});
 try {assert.equal(prefs.getDarkMode(),true);assert.doesNotThrow(()=>prefs.saveDarkMode(false));} finally {if(previous) Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
