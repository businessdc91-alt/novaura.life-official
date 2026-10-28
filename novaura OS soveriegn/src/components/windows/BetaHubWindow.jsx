import React from 'react';
import SettingsDiagnosticsWindow from './SettingsDiagnosticsWindow.jsx';

export default function BetaHubWindow(props) {
  return <SettingsDiagnosticsWindow {...props} defaultTab="beta" />;
}
