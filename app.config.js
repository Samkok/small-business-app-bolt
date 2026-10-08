// Extends app.json. The Meta (Facebook) SDK config plugin refuses to run without an app id, so
// it is only added when EXPO_PUBLIC_META_APP_ID is set at build time. While the id is empty the
// package react-native-fbsdk-next is not installed either (its iOS adapter would initialise the
// Meta SDK at every launch, app id or not), so the build contains no Meta code at all. Switching
// it on: `npx expo install react-native-fbsdk-next`, set the two EXPO_PUBLIC_META_* values, rebuild.
const metaAppId = (process.env.EXPO_PUBLIC_META_APP_ID || '').trim();
const metaClientToken = (process.env.EXPO_PUBLIC_META_CLIENT_TOKEN || '').trim();

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  if (metaAppId) {
    plugins.push([
      'react-native-fbsdk-next',
      {
        appID: metaAppId,
        clientToken: metaClientToken || undefined,
        displayName: config.name || 'BizManage',
        scheme: `fb${metaAppId}`,
        // The tracker initialises the SDK itself after the user is known and the iOS tracking
        // prompt has been answered, so nothing is logged before consent
        isAutoInitEnabled: false,
        autoLogAppEventsEnabled: true,
        advertiserIDCollectionEnabled: true,
      },
    ]);
  }
  return { ...config, plugins };
};
