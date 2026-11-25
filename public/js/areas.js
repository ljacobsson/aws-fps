import { lobby, serviceRoom } from './areas/lobby.js';
import { cloudwatchRoom } from './areas/cloudwatch.js';
import { vpcTunnel, vpcRoom } from './areas/vpc.js';
import { cfnHall, stackRoom } from './areas/cfn.js';
import { graveyard } from './areas/graveyard.js';

export const AREAS = {
  lobby,
  service: serviceRoom,
  cloudwatch: cloudwatchRoom,
  vpcTunnel,
  vpc: vpcRoom,
  cfnHall,
  stack: stackRoom,
  graveyard,
};
