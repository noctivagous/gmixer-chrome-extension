(() => {
  // src/debug/main-world-bridge.js
  (() => {
    if (globalThis.gmixerDebug?.__gmixerBridge) return;
    const REQUEST_TYPE = "GMIXER_DEBUG_REQUEST";
    const RESPONSE_TYPE = "GMIXER_DEBUG_RESPONSE";
    const pending = /* @__PURE__ */ new Map();
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== RESPONSE_TYPE || typeof data.id !== "string") return;
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.ok) entry.resolve(data.result);
      else entry.reject(new Error(data.error || "gmixerDebug call failed"));
    });
    function call(method, args) {
      const id = `gmixer-debug-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.postMessage(
          {
            type: REQUEST_TYPE,
            id,
            method,
            args: args || []
          },
          window.location.origin
        );
        window.setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(`gmixerDebug.${method} timed out`));
        }, 8e3);
      });
    }
    const methods = [
      "state",
      "resolvedState",
      "openSettings",
      "closeSettings",
      "toggleSection",
      "setSectionEnabled",
      "setEnabled",
      "setThemeMode",
      "setSettingsFocus",
      "samplePage",
      "findPrimaryBackground",
      "inspectRoles",
      "inspectLiveSurfaces",
      "openSurfaceInspector",
      "rebuildCss",
      "dumpDiagnostics"
    ];
    const api = { __gmixerBridge: true };
    for (const name of methods) {
      api[name] = (...args) => call(name, args);
    }
    globalThis.__GMIXER_DEBUG__ = true;
    globalThis.gmixerDebug = api;
  })();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2RlYnVnL21haW4td29ybGQtYnJpZGdlLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBQYWdlIG1haW4td29ybGQgc3R1YiBmb3Igd2luZG93LmdtaXhlckRlYnVnLlxuLy8gRm9yd2FyZHMgY2FsbHMgdG8gdGhlIGNvbnRlbnQtc2NyaXB0IGRlYnVnIEFQSSB2aWEgd2luZG93LnBvc3RNZXNzYWdlLlxuLy8gQnVuZGxlZCBhcyBleHRlbnNpb24vZGVidWctYnJpZGdlLmpzIGFuZCBpbmplY3RlZCBvbmx5IGluIGRlYnVnIGJ1aWxkcy5cblxuKCgpID0+IHtcbiAgaWYgKGdsb2JhbFRoaXMuZ21peGVyRGVidWc/Ll9fZ21peGVyQnJpZGdlKSByZXR1cm47XG5cbiAgY29uc3QgUkVRVUVTVF9UWVBFID0gJ0dNSVhFUl9ERUJVR19SRVFVRVNUJztcbiAgY29uc3QgUkVTUE9OU0VfVFlQRSA9ICdHTUlYRVJfREVCVUdfUkVTUE9OU0UnO1xuICAvKiogQHR5cGUge01hcDxzdHJpbmcsIHsgcmVzb2x2ZTogKHY6IHVua25vd24pID0+IHZvaWQsIHJlamVjdDogKGU6IEVycm9yKSA9PiB2b2lkIH0+fSAqL1xuICBjb25zdCBwZW5kaW5nID0gbmV3IE1hcCgpO1xuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGV2ZW50LnNvdXJjZSAhPT0gd2luZG93KSByZXR1cm47XG4gICAgaWYgKGV2ZW50Lm9yaWdpbiAhPT0gd2luZG93LmxvY2F0aW9uLm9yaWdpbikgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSBldmVudC5kYXRhO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLnR5cGUgIT09IFJFU1BPTlNFX1RZUEUgfHwgdHlwZW9mIGRhdGEuaWQgIT09ICdzdHJpbmcnKSByZXR1cm47XG4gICAgY29uc3QgZW50cnkgPSBwZW5kaW5nLmdldChkYXRhLmlkKTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgcGVuZGluZy5kZWxldGUoZGF0YS5pZCk7XG4gICAgaWYgKGRhdGEub2spIGVudHJ5LnJlc29sdmUoZGF0YS5yZXN1bHQpO1xuICAgIGVsc2UgZW50cnkucmVqZWN0KG5ldyBFcnJvcihkYXRhLmVycm9yIHx8ICdnbWl4ZXJEZWJ1ZyBjYWxsIGZhaWxlZCcpKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gY2FsbChtZXRob2QsIGFyZ3MpIHtcbiAgICBjb25zdCBpZCA9IGBnbWl4ZXItZGVidWctJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpfWA7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHBlbmRpbmcuc2V0KGlkLCB7IHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6IFJFUVVFU1RfVFlQRSxcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgYXJnczogYXJncyB8fCBbXSxcbiAgICAgICAgfSxcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLm9yaWdpblxuICAgICAgKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaWYgKCFwZW5kaW5nLmhhcyhpZCkpIHJldHVybjtcbiAgICAgICAgcGVuZGluZy5kZWxldGUoaWQpO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGBnbWl4ZXJEZWJ1Zy4ke21ldGhvZH0gdGltZWQgb3V0YCkpO1xuICAgICAgfSwgODAwMCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBtZXRob2RzID0gW1xuICAgICdzdGF0ZScsXG4gICAgJ3Jlc29sdmVkU3RhdGUnLFxuICAgICdvcGVuU2V0dGluZ3MnLFxuICAgICdjbG9zZVNldHRpbmdzJyxcbiAgICAndG9nZ2xlU2VjdGlvbicsXG4gICAgJ3NldFNlY3Rpb25FbmFibGVkJyxcbiAgICAnc2V0RW5hYmxlZCcsXG4gICAgJ3NldFRoZW1lTW9kZScsXG4gICAgJ3NldFNldHRpbmdzRm9jdXMnLFxuICAgICdzYW1wbGVQYWdlJyxcbiAgICAnZmluZFByaW1hcnlCYWNrZ3JvdW5kJyxcbiAgICAnaW5zcGVjdFJvbGVzJyxcbiAgICAnaW5zcGVjdExpdmVTdXJmYWNlcycsXG4gICAgJ29wZW5TdXJmYWNlSW5zcGVjdG9yJyxcbiAgICAncmVidWlsZENzcycsXG4gICAgJ2R1bXBEaWFnbm9zdGljcycsXG4gIF07XG5cbiAgLyoqIEB0eXBlIHtSZWNvcmQ8c3RyaW5nLCAoLi4uYXJnczogdW5rbm93bltdKSA9PiBQcm9taXNlPHVua25vd24+Pn0gKi9cbiAgY29uc3QgYXBpID0geyBfX2dtaXhlckJyaWRnZTogdHJ1ZSB9O1xuICBmb3IgKGNvbnN0IG5hbWUgb2YgbWV0aG9kcykge1xuICAgIGFwaVtuYW1lXSA9ICguLi5hcmdzKSA9PiBjYWxsKG5hbWUsIGFyZ3MpO1xuICB9XG5cbiAgZ2xvYmFsVGhpcy5fX0dNSVhFUl9ERUJVR19fID0gdHJ1ZTtcbiAgZ2xvYmFsVGhpcy5nbWl4ZXJEZWJ1ZyA9IGFwaTtcbn0pKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOztBQUlBLEdBQUMsTUFBTTtBQUNMLFFBQUksV0FBVyxhQUFhLGVBQWdCO0FBRTVDLFVBQU0sZUFBZTtBQUNyQixVQUFNLGdCQUFnQjtBQUV0QixVQUFNLFVBQVUsb0JBQUksSUFBSTtBQUV4QixXQUFPLGlCQUFpQixXQUFXLENBQUMsVUFBVTtBQUM1QyxVQUFJLE1BQU0sV0FBVyxPQUFRO0FBQzdCLFVBQUksTUFBTSxXQUFXLE9BQU8sU0FBUyxPQUFRO0FBQzdDLFlBQU0sT0FBTyxNQUFNO0FBQ25CLFVBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxpQkFBaUIsT0FBTyxLQUFLLE9BQU8sU0FBVTtBQUN6RSxZQUFNLFFBQVEsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUNqQyxVQUFJLENBQUMsTUFBTztBQUNaLGNBQVEsT0FBTyxLQUFLLEVBQUU7QUFDdEIsVUFBSSxLQUFLLEdBQUksT0FBTSxRQUFRLEtBQUssTUFBTTtBQUFBLFVBQ2pDLE9BQU0sT0FBTyxJQUFJLE1BQU0sS0FBSyxTQUFTLHlCQUF5QixDQUFDO0FBQUEsSUFDdEUsQ0FBQztBQUVELGFBQVMsS0FBSyxRQUFRLE1BQU07QUFDMUIsWUFBTSxLQUFLLGdCQUFnQixLQUFLLElBQUksQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVFLGFBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3RDLGdCQUFRLElBQUksSUFBSSxFQUFFLFNBQVMsT0FBTyxDQUFDO0FBQ25DLGVBQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTjtBQUFBLFlBQ0E7QUFBQSxZQUNBLE1BQU0sUUFBUSxDQUFDO0FBQUEsVUFDakI7QUFBQSxVQUNBLE9BQU8sU0FBUztBQUFBLFFBQ2xCO0FBQ0EsZUFBTyxXQUFXLE1BQU07QUFDdEIsY0FBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQUc7QUFDdEIsa0JBQVEsT0FBTyxFQUFFO0FBQ2pCLGlCQUFPLElBQUksTUFBTSxlQUFlLE1BQU0sWUFBWSxDQUFDO0FBQUEsUUFDckQsR0FBRyxHQUFJO0FBQUEsTUFDVCxDQUFDO0FBQUEsSUFDSDtBQUVBLFVBQU0sVUFBVTtBQUFBLE1BQ2Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBR0EsVUFBTSxNQUFNLEVBQUUsZ0JBQWdCLEtBQUs7QUFDbkMsZUFBVyxRQUFRLFNBQVM7QUFDMUIsVUFBSSxJQUFJLElBQUksSUFBSSxTQUFTLEtBQUssTUFBTSxJQUFJO0FBQUEsSUFDMUM7QUFFQSxlQUFXLG1CQUFtQjtBQUM5QixlQUFXLGNBQWM7QUFBQSxFQUMzQixHQUFHOyIsCiAgIm5hbWVzIjogW10KfQo=
