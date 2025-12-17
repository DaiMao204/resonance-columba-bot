import { ResonanceSkills } from "../interfaces/role-skill";
import { RESONANCE_SKILLS } from "resonance-data-columba/dist/columbabuild";



export var ROLE_RESONANCE_SKILLS: {
  [role: string]: ResonanceSkills;
} = RESONANCE_SKILLS;

export function roleSkills_set (RESONANCE_SKILLS){
  ROLE_RESONANCE_SKILLS = RESONANCE_SKILLS
}
