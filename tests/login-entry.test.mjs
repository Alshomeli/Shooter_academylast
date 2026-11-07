import test from 'node:test';
import assert from 'node:assert/strict';
import {getLoginScreen} from '../src/lib/login-entry.ts';
const base={recovery:false,registrationEntry:false,staffRegistrationEntry:false,search:''};
test('legacy reset links open the real forgot form',()=>{assert.equal(getLoginScreen({...base,search:'?view=login&screen=forgot'}),'forgot');assert.equal(getLoginScreen({...base,search:'?screen=anything'}),'login');});
test('recovery and onboarding retain priority over the forgotten-password shortcut',()=>{assert.equal(getLoginScreen({...base,recovery:true,search:'?screen=forgot'}),'reset');assert.equal(getLoginScreen({...base,registrationEntry:true,search:'?screen=forgot'}),'register');assert.equal(getLoginScreen({...base,staffRegistrationEntry:true,search:'?screen=forgot'}),'register');});
