import { act, create } from 'react-test-renderer';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { TRUECALLER_ANDROID_EVENTS } from '../constants';
import type { UseTruecallerResult } from '../interfaces';

// `useTruecaller.ts` reads `NativeModules.TruecallerModule` into a
// module-level constant at import time, so the native module mock must exist
// on NativeModules *before* the hook module is first required.
NativeModules.TruecallerModule = {
  initializeSdk: jest.fn().mockResolvedValue(undefined),
  isSdkUsable: jest.fn().mockResolvedValue(true),
  requestAuthorizationCode: jest.fn().mockResolvedValue(undefined),
  clearSdk: jest.fn(),
};

const { useTruecaller } = require('../hooks/useTruecaller');

// Minimal harness: renders the hook via a bare functional component and
// exposes the latest hook result through a mutable ref, since this repo has
// no @testing-library/react-hooks (or equivalent) in devDependencies.
function renderTruecallerHook(config: Parameters<typeof useTruecaller>[0]) {
  const resultRef: { current: UseTruecallerResult | null } = { current: null };

  function Harness() {
    resultRef.current = useTruecaller(config);
    return null;
  }

  let root: ReturnType<typeof create>;
  act(() => {
    root = create(<Harness />);
  });

  return {
    result: resultRef,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useTruecaller (Android ready-listener lifecycle)', () => {
  const config = { androidClientId: 'test-client-id' };

  beforeEach(() => {
    Platform.OS = 'android';
    (NativeModules.TruecallerModule.initializeSdk as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);
    (NativeModules.TruecallerModule.isSdkUsable as jest.Mock)
      .mockReset()
      .mockResolvedValue(true);
    (NativeModules.TruecallerModule.requestAuthorizationCode as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);
    (NativeModules.TruecallerModule.clearSdk as jest.Mock).mockReset();
    DeviceEventEmitter.removeAllListeners(TRUECALLER_ANDROID_EVENTS.READY);
    DeviceEventEmitter.removeAllListeners(TRUECALLER_ANDROID_EVENTS.ERROR);
    DeviceEventEmitter.removeAllListeners(TRUECALLER_ANDROID_EVENTS.FAILURE);
  });

  it('flips isTruecallerInitialized to true when TruecallerAndroidReady fires after init', async () => {
    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });
    expect(result.current!.isTruecallerInitialized).toBe(false);

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.READY);
    });

    expect(result.current!.isTruecallerInitialized).toBe(true);
  });

  it('does not stack listeners when initializeTruecallerSDK is called twice before ready fires', async () => {
    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });
    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });

    const listenerCountBefore = DeviceEventEmitter.listenerCount(
      TRUECALLER_ANDROID_EVENTS.READY
    );
    expect(listenerCountBefore).toBe(1);

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.READY);
    });

    expect(result.current!.isTruecallerInitialized).toBe(true);
    // Listener should have removed itself after firing once.
    expect(
      DeviceEventEmitter.listenerCount(TRUECALLER_ANDROID_EVENTS.READY)
    ).toBe(0);
  });

  it('ignores a late TruecallerAndroidReady event if native init rejected', async () => {
    (
      NativeModules.TruecallerModule.initializeSdk as jest.Mock
    ).mockRejectedValue(new Error('native init failed'));

    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });

    expect(result.current!.isTruecallerInitialized).toBe(false);
    expect(result.current!.error).toBe('native init failed');

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.READY);
    });

    expect(result.current!.isTruecallerInitialized).toBe(false);
  });

  it('removes the pending ready listener on unmount', async () => {
    const { result, unmount } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });
    expect(
      DeviceEventEmitter.listenerCount(TRUECALLER_ANDROID_EVENTS.READY)
    ).toBe(1);

    unmount();

    expect(
      DeviceEventEmitter.listenerCount(TRUECALLER_ANDROID_EVENTS.READY)
    ).toBe(0);

    // Emitting after unmount must not throw or resurrect state.
    expect(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.READY);
    }).not.toThrow();
  });

  it('registers an init-time error listener that reports errors emitted before ready fires', async () => {
    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.ERROR, {
        errorMessage: 'init blew up',
      });
    });

    expect(result.current!.error).toBe('init blew up');
    expect(result.current!.isTruecallerInitialized).toBe(false);
  });

  it('registers an init-time failure listener that reports SDK-side onFailure events emitted before ready fires', async () => {
    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.FAILURE, {
        errorMessage: 'sdk init failure',
      });
    });

    expect(result.current!.error).toBe('sdk init failure');
    expect(result.current!.isTruecallerInitialized).toBe(false);
  });

  it('ignores a late TruecallerAndroidReady event after an init-time FAILURE was already reported', async () => {
    const { result } = renderTruecallerHook(config);

    await act(async () => {
      await result.current!.initializeTruecallerSDK();
    });

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.FAILURE, {
        errorMessage: 'sdk init failure',
      });
    });
    expect(result.current!.error).toBe('sdk init failure');

    act(() => {
      DeviceEventEmitter.emit(TRUECALLER_ANDROID_EVENTS.READY);
    });

    expect(result.current!.isTruecallerInitialized).toBe(false);
    expect(result.current!.error).toBe('sdk init failure');
  });
});
