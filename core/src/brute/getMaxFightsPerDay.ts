import { Brute } from '@labrute/prisma';
import { MAX_STACK_FIGHTS } from '../constants';

const getMaxFightsPerDay = (brute: Pick<Brute, 'skills'>) => (brute.skills.includes('regeneration') ? MAX_STACK_FIGHTS + 2 : MAX_STACK_FIGHTS);

export default getMaxFightsPerDay;