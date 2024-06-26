/* eslint-disable no-void */
import { FIGHTER_HEIGHT, FIGHTER_WIDTH, ThrowStep } from '@labrute/core';
import { sound } from '@pixi/sound';
import { Easing, Tweener } from 'pixi-tweener';
import { Application, Sprite } from 'pixi.js';
import findFighter, { AnimationFighter } from './findFighter';
import getFighterType from './getFighterType';

const throwWeapon = async (
  app: Application,
  fighters: AnimationFighter[],
  step: ThrowStep,
  speed: React.MutableRefObject<number>,
) => {
  if (!app.loader) {
    return;
  }
  const { loader: { resources: { '/images/game/thrown-weapons.json': { spritesheet } } } } = app;

  if (!spritesheet) {
    throw new Error('Spritesheet not found');
  }

  const fighter = findFighter(fighters, step.fighter);
  if (!fighter) {
    throw new Error('Fighter not found');
  }

  const opponent = findFighter(fighters, step.opponent);
  if (!opponent) {
    throw new Error('Opponent not found');
  }

  const prepareEnded = fighter.animation.waitForEvent('prepare-throw:end');

  // Set animation to `prepare-throw`
  fighter.animation.setAnimation('prepare-throw');

  // Wait for animation to finish
  await prepareEnded;

  // Remove weapon from brute if needed
  if (!step.keep) {
    fighter.animation.weapon = null;
  }

  // Set animation to `throw`
  fighter.animation.setAnimation('throw');

  // Create thrown weapon sprite
  const thrownWeapon = new Sprite(spritesheet.textures[`${step.weapon}.png`]);

  // Anchor to left center
  thrownWeapon.anchor.set(0, 0.5);

  // Get starting position
  const start = {
    x: fighter.animation.team === 'left'
      ? fighter.animation.container.x + FIGHTER_WIDTH.brute
      : fighter.animation.container.x,
    y: fighter.animation.container.y - FIGHTER_HEIGHT.brute * 0.5,
  };

  // Get end position
  const end = {
    x: opponent.animation.team === 'left'
      ? opponent.animation.container.x + FIGHTER_WIDTH[getFighterType(opponent)]
      : opponent.animation.container.x,
    y: opponent.animation.container.y - FIGHTER_HEIGHT[getFighterType(opponent)] * 0.5,
  };

  // Set position
  thrownWeapon.position.set(start.x, start.y);

  // Set rotation (from fighter and opponent positions)
  thrownWeapon.angle = (Math.atan2(
    end.y - start.y,
    end.x - start.x,
  ) * 180) / Math.PI;

  // Add to stage
  app.stage.addChild(thrownWeapon);

  // Play throw SFX
  void sound.play('skills/net', {
    speed: speed.current,
  });

  // Move thrown weapon
  await Tweener.add({
    target: thrownWeapon,
    duration: 0.25 / speed.current,
    ease: Easing.linear,
  }, {
    x: end.x,
    y: end.y,
  });

  // Remove thrown weapon
  app.stage.removeChild(thrownWeapon);
  thrownWeapon.destroy();

  // Set animation to `idle`
  fighter.animation.setAnimation('idle');
};

export default throwWeapon;