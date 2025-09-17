import { createProxyAgents } from '../src/proxyAgentBrowser';

describe('configureProxyAgent', () => {
  it('should return undefined', () => {
    const consoleSpy = jest.spyOn(console, 'warn');

    const proxySettings = {
      address: 'http://proxy.example.com',
      port: 8080,
      auth: {
        username: 'user',
        password: 'pass',
      },
    };
    const proxyAgents = createProxyAgents(proxySettings);
    expect(proxyAgents).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Proxy agents are not supported in browser environment'
    );
  });
});
