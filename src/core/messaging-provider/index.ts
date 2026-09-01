export * from './types';
export * from './simulation-adapter';

import { SimulationMessagingAdapter } from './simulation-adapter';
import { MessagingExecutionProvider, MessagingStatusProvider } from './types';

export class MessagingProviderFactory {
  private static simulationInstance: SimulationMessagingAdapter;

  public static getSimulationAdapter(): SimulationMessagingAdapter {
    if (!MessagingProviderFactory.simulationInstance) {
      MessagingProviderFactory.simulationInstance = new SimulationMessagingAdapter();
    }
    return MessagingProviderFactory.simulationInstance;
  }

  public static getProvider(mode: 'SIMULATION' | 'LIVE' = 'SIMULATION'): MessagingExecutionProvider & MessagingStatusProvider {
    return MessagingProviderFactory.getSimulationAdapter();
  }
}
