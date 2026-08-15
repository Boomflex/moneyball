using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;

namespace MoneyballLauncher
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MoneyballLauncherPlugin : BasePlugin
    {
        public const string PluginGuid = "com.boomflex.fm26.moneyball.launcher";
        public const string PluginName = "Moneyball Launcher";
        public const string PluginVersion = "0.1.0";

        private ConfigEntry<string> moneyballPath;
        private ConfigEntry<string> nodePath;
        private ConfigEntry<string> exportDir;
        private ConfigEntry<int> appPort;
        private ConfigEntry<int> bridgePort;
        private ConfigEntry<bool> startApp;
        private ConfigEntry<bool> startBridge;
        private ConfigEntry<bool> openBrowser;

        public override void Load()
        {
            moneyballPath = Config.Bind("Paths", "MoneyballPath", @"C:\Users\jakek\OneDrive\Documents\Moneyball", "Path to the Moneyball webapp project.");
            nodePath = Config.Bind("Paths", "NodePath", ResolveNodePath(), "Path to node.exe. Leave as node.exe if Node is on PATH.");
            exportDir = Config.Bind("Paths", "ExportDir", "", "Optional FM26 Player Export CSV folder override. Leave blank for the bridge default.");
            appPort = Config.Bind("Ports", "AppPort", 5173, "Moneyball webapp port.");
            bridgePort = Config.Bind("Ports", "BridgePort", 8712, "FM26 export bridge port.");
            startApp = Config.Bind("Startup", "StartMoneyballApp", true, "Start the Moneyball webapp when FM26 starts.");
            startBridge = Config.Bind("Startup", "StartExportBridge", true, "Start the real FM26 export bridge when FM26 starts.");
            openBrowser = Config.Bind("Startup", "OpenBrowser", true, "Open Moneyball in the default browser when FM26 starts.");

            try
            {
                StartMoneyball();
            }
            catch (Exception ex)
            {
                Log.LogError("Moneyball Launcher failed: " + ex);
            }
        }

        private void StartMoneyball()
        {
            string projectPath = moneyballPath.Value;
            if (!Directory.Exists(projectPath))
            {
                Log.LogWarning("Moneyball path does not exist: " + projectPath);
                return;
            }

            if (startApp.Value)
            {
                StartNodeIfNeeded(appPort.Value, "scripts\\dev-server.mjs " + appPort.Value, "Moneyball app");
            }

            if (startBridge.Value)
            {
                string args = "scripts\\fm26-export-bridge.mjs " + bridgePort.Value;
                if (!string.IsNullOrWhiteSpace(exportDir.Value))
                {
                    args += " \"" + exportDir.Value + "\"";
                }
                StartNodeIfNeeded(bridgePort.Value, args, "FM26 export bridge");
            }

            if (openBrowser.Value)
            {
                OpenUrl("http://127.0.0.1:" + appPort.Value + "/");
            }
        }

        private void StartNodeIfNeeded(int port, string arguments, string label)
        {
            if (IsPortOpen("127.0.0.1", port))
            {
                Log.LogInfo(label + " already running on port " + port);
                return;
            }

            string projectPath = moneyballPath.Value;
            var psi = new ProcessStartInfo
            {
                FileName = nodePath.Value,
                Arguments = arguments,
                WorkingDirectory = projectPath,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(psi);
            Log.LogInfo("Started " + label + " on port " + port);
        }

        private static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    bool connected = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
                    if (!connected) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true,
                });
                Log.LogInfo("Opened " + url);
            }
            catch (Exception ex)
            {
                Log.LogWarning("Could not open browser: " + ex.Message);
            }
        }

        private static string ResolveNodePath()
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string candidate = Path.Combine(programFiles, "nodejs", "node.exe");
            return File.Exists(candidate) ? candidate : "node.exe";
        }
    }
}
