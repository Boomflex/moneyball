using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace MoneyballUiInspector
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MoneyballUiInspectorPlugin : BasePlugin
    {
        public const string PluginGuid = "com.boomflex.fm26.moneyball.uiinspector";
        public const string PluginName = "Moneyball UI Inspector";
        public const string PluginVersion = "0.1.0";

        private ConfigEntry<bool> enabledOnStart;
        private ConfigEntry<bool> logHover;
        private ConfigEntry<float> hoverIntervalSeconds;
        private ConfigEntry<int> maxHierarchyDepth;

        public override void Load()
        {
            enabledOnStart = Config.Bind("Inspector", "EnabledOnStart", true, "Start logging click targets as soon as FM26 loads.");
            logHover = Config.Bind("Inspector", "LogHover", false, "Log hover targets on an interval. Clicks are always logged when enabled.");
            hoverIntervalSeconds = Config.Bind("Inspector", "HoverIntervalSeconds", 0.75f, "Seconds between hover target samples.");
            maxHierarchyDepth = Config.Bind("Inspector", "MaxHierarchyDepth", 18, "Maximum parent-chain depth to record.");

            ClassInjector.RegisterTypeInIl2Cpp<UiInspectorBehaviour>();
            var go = new GameObject("Moneyball UI Inspector");
            UnityEngine.Object.DontDestroyOnLoad(go);
            var behaviour = go.AddComponent<UiInspectorBehaviour>();
            behaviour.Init(Log, Config.ConfigFilePath, enabledOnStart.Value, logHover.Value, hoverIntervalSeconds.Value, maxHierarchyDepth.Value);
            Log.LogInfo("Moneyball UI Inspector loaded. F10 toggles logging; F11 dumps the current UI tree.");
        }
    }

    public sealed class UiInspectorBehaviour : MonoBehaviour
    {
        private ManualLogSource logger;
        private string logPath;
        private bool inspectorEnabled;
        private bool logHover;
        private float hoverIntervalSeconds;
        private int maxHierarchyDepth;
        private float nextHoverTime;
        private string lastHoverSignature = "";
        private bool updateFaulted;

        public UiInspectorBehaviour(IntPtr ptr) : base(ptr)
        {
        }

        public void Init(ManualLogSource source, string configPath, bool enabledOnStart, bool hoverEnabled, float hoverInterval, int hierarchyDepth)
        {
            logger = source;
            inspectorEnabled = enabledOnStart;
            logHover = hoverEnabled;
            hoverIntervalSeconds = Math.Max(0.15f, hoverInterval);
            maxHierarchyDepth = Math.Max(4, hierarchyDepth);

            string configDir = Path.GetDirectoryName(configPath) ?? Paths.ConfigPath;
            string dir = Path.Combine(configDir, "MoneyballUiInspector");
            Directory.CreateDirectory(dir);
            logPath = Path.Combine(dir, "ui-events.jsonl");
            WriteEvent("{\"event\":\"inspector-start\",\"enabled\":" + JsonBool(inspectorEnabled) + ",\"path\":\"" + Json(logPath) + "\"}");
        }

        private void Update()
        {
            if (updateFaulted) return;

            try
            {
                UpdateInspector();
            }
            catch (Exception ex)
            {
                updateFaulted = true;
                inspectorEnabled = false;
                logger?.LogError("Moneyball UI Inspector disabled after Update failure: " + ex);
                WriteEvent("{\"event\":\"update-error\",\"message\":\"" + Json(ex.Message) + "\",\"type\":\"" + Json(ex.GetType().FullName) + "\"}");
            }
        }

        private void UpdateInspector()
        {
            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;

            if (keyboard != null && keyboard.f10Key.wasPressedThisFrame)
            {
                inspectorEnabled = !inspectorEnabled;
                logger?.LogInfo("Moneyball UI Inspector " + (inspectorEnabled ? "enabled" : "disabled"));
                WriteEvent("{\"event\":\"toggle\",\"enabled\":" + JsonBool(inspectorEnabled) + ",\"time\":" + Time.realtimeSinceStartup.ToString("0.000") + "}");
            }

            if (keyboard != null && keyboard.f11Key.wasPressedThisFrame)
            {
                DumpUiTree();
            }

            if (!inspectorEnabled) return;

            if (mouse != null && mouse.leftButton.wasPressedThisFrame)
            {
                LogTarget("click");
            }

            if (logHover && Time.realtimeSinceStartup >= nextHoverTime)
            {
                nextHoverTime = Time.realtimeSinceStartup + hoverIntervalSeconds;
                LogTarget("hover");
            }
        }

        private void LogTarget(string eventName)
        {
            var point = MousePanelPoint();
            var target = FindDeepestElementAt(point);
            if (target == null)
            {
                if (eventName == "click") WriteEvent(EventPrefix(eventName, point) + ",\"target\":null}");
                return;
            }

            string signature = target.GetHashCode() + ":" + target.name + ":" + target.GetType().FullName;
            if (eventName == "hover" && signature == lastHoverSignature) return;
            if (eventName == "hover") lastHoverSignature = signature;

            string payload = EventPrefix(eventName, point)
                + ",\"target\":" + ElementJson(target)
                + ",\"hierarchy\":[" + HierarchyJson(target) + "]"
                + "}";
            WriteEvent(payload);
            if (eventName == "click")
            {
                logger?.LogInfo("UI click: " + ElementSummary(target));
            }
        }

        private Vector2 MousePanelPoint()
        {
            Mouse mouse = Mouse.current;
            if (mouse == null) return new Vector2(0, 0);
            Vector2 position = mouse.position.ReadValue();
            return new Vector2(position.x, Screen.height - position.y);
        }

        private VisualElement FindDeepestElementAt(Vector2 point)
        {
            UIDocument[] documents = UnityEngine.Object.FindObjectsOfType<UIDocument>();
            VisualElement best = null;
            int bestDepth = -1;
            foreach (var document in documents)
            {
                if (document == null) continue;
                var root = document.rootVisualElement;
                if (root == null) continue;
                var found = FindDeepestInTree(root, point, 0);
                if (found.element != null && found.depth > bestDepth)
                {
                    best = found.element;
                    bestDepth = found.depth;
                }
            }
            return best;
        }

        private ElementDepth FindDeepestInTree(VisualElement element, Vector2 point, int depth)
        {
            if (element == null || !element.worldBound.Contains(point)) return new ElementDepth(null, -1);
            VisualElement best = element;
            int bestDepth = depth;
            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                var child = element.ElementAt(i);
                var found = FindDeepestInTree(child, point, depth + 1);
                if (found.element != null && found.depth > bestDepth)
                {
                    best = found.element;
                    bestDepth = found.depth;
                }
            }
            return new ElementDepth(best, bestDepth);
        }

        private string EventPrefix(string eventName, Vector2 point)
        {
            return "{\"event\":\"" + Json(eventName) + "\",\"time\":" + Time.realtimeSinceStartup.ToString("0.000")
                + ",\"mouse\":{\"x\":" + point.x.ToString("0.0") + ",\"y\":" + point.y.ToString("0.0") + "}";
        }

        private string ElementJson(VisualElement element)
        {
            Rect rect = element.worldBound;
            return "{"
                + "\"type\":\"" + Json(element.GetType().FullName) + "\""
                + ",\"name\":\"" + Json(element.name) + "\""
                + ",\"text\":\"" + Json(ElementText(element)) + "\""
                + ",\"classes\":\"" + Json(SafeClasses(element)) + "\""
                + ",\"bounds\":{\"x\":" + rect.x.ToString("0.0") + ",\"y\":" + rect.y.ToString("0.0") + ",\"w\":" + rect.width.ToString("0.0") + ",\"h\":" + rect.height.ToString("0.0") + "}"
                + "}";
        }

        private string HierarchyJson(VisualElement element)
        {
            var parts = new List<string>();
            VisualElement current = element;
            int depth = 0;
            while (current != null && depth < maxHierarchyDepth)
            {
                parts.Add(ElementJson(current));
                current = current.parent;
                depth += 1;
            }
            return string.Join(",", parts);
        }

        private string SafeClasses(VisualElement element)
        {
            return "";
        }

        private string ElementText(VisualElement element)
        {
            try
            {
                var text = element as TextElement;
                return text?.text ?? "";
            }
            catch
            {
                return "";
            }
        }

        private string ElementSummary(VisualElement element)
        {
            string name = string.IsNullOrWhiteSpace(element.name) ? "(no-name)" : element.name;
            string text = ElementText(element);
            string type = element.GetType().Name;
            return type + " " + name + (string.IsNullOrWhiteSpace(text) ? "" : " text=\"" + text + "\"");
        }

        private void DumpUiTree()
        {
            var point = MousePanelPoint();
            UIDocument[] documents = UnityEngine.Object.FindObjectsOfType<UIDocument>();
            var sb = new StringBuilder();
            sb.Append("{\"event\":\"tree-dump\",\"time\":").Append(Time.realtimeSinceStartup.ToString("0.000"));
            sb.Append(",\"mouse\":{\"x\":").Append(point.x.ToString("0.0")).Append(",\"y\":").Append(point.y.ToString("0.0")).Append("}");
            sb.Append(",\"documents\":[");
            for (int i = 0; i < documents.Length; i += 1)
            {
                if (i > 0) sb.Append(",");
                var document = documents[i];
                sb.Append("{\"name\":\"").Append(Json(document?.name ?? "")).Append("\",\"root\":");
                sb.Append(document?.rootVisualElement == null ? "null" : TreeJson(document.rootVisualElement, 0, 5));
                sb.Append("}");
            }
            sb.Append("]}");
            WriteEvent(sb.ToString());
            logger?.LogInfo("UI tree dumped to " + logPath);
        }

        private string TreeJson(VisualElement element, int depth, int maxDepth)
        {
            if (element == null) return "null";
            var sb = new StringBuilder();
            sb.Append(ElementJson(element));
            if (depth < maxDepth && element.childCount > 0)
            {
                string head = sb.ToString();
                sb.Clear();
                sb.Append(head.Substring(0, head.Length - 1));
                sb.Append(",\"children\":[");
                int limit = Math.Min(element.childCount, 80);
                for (int i = 0; i < limit; i += 1)
                {
                    if (i > 0) sb.Append(",");
                    sb.Append(TreeJson(element.ElementAt(i), depth + 1, maxDepth));
                }
                if (element.childCount > limit)
                {
                    sb.Append(",{\"type\":\"truncated\",\"name\":\"").Append(element.childCount - limit).Append(" more\"}");
                }
                sb.Append("]}");
            }
            return sb.ToString();
        }

        private void WriteEvent(string json)
        {
            try
            {
                File.AppendAllText(logPath, json + Environment.NewLine, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                logger?.LogWarning("Could not write UI inspector log: " + ex.Message);
            }
        }

        private static string Json(string value)
        {
            if (value == null) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private static string JsonBool(bool value)
        {
            return value ? "true" : "false";
        }

        private readonly struct ElementDepth
        {
            public readonly VisualElement element;
            public readonly int depth;

            public ElementDepth(VisualElement element, int depth)
            {
                this.element = element;
                this.depth = depth;
            }
        }
    }
}
