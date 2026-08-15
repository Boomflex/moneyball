using System;
using System.IO;
using System.Reflection;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using HarmonyLib;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using UnityEngine.UIElements;

namespace MoneyballUiTweaks
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MoneyballUiTweaksPlugin : BasePlugin
    {
        public const string PluginGuid = "com.boomflex.fm26.moneyball.uitweaks";
        public const string PluginName = "Moneyball UI Tweaks";
        public const string PluginVersion = "0.1.0";

        private ConfigEntry<bool> hideIndividualTrainingProgressGraph;
        private ConfigEntry<float> scanIntervalSeconds;
        private ConfigEntry<bool> enableBundleOverrides;
        private ConfigEntry<string> bundleOverrideDirectory;
        private ConfigEntry<bool> bundleOverridesUiOnly;
        private ConfigEntry<bool> logBundleRedirects;
        private ConfigEntry<bool> enablePlayerReportTileProbe;
        private ConfigEntry<bool> enablePlayerReportOverviewPerformanceBlock;
        private ConfigEntry<string> playerReportOverviewPerformanceBlockKey;
        private ConfigEntry<bool> enablePlayerReportOverviewPer90LiveMove;
        private ConfigEntry<bool> enablePlayerReportOverviewCarouselProbe;
        private ConfigEntry<bool> enablePlayerReportOverviewForceSecondCarouselPage;
        private ConfigEntry<bool> lockPlayerReportOverviewStatsCarousel;
        private Harmony harmony;

        public override void Load()
        {
            hideIndividualTrainingProgressGraph = Config.Bind(
                "Individual Training",
                "HideProgressReportGraph",
                true,
                "Hide the Progress Report line chart in Squad > Training > Individual Training."
            );
            scanIntervalSeconds = Config.Bind(
                "Performance",
                "ScanIntervalSeconds",
                0.5f,
                "Seconds between UI scans for matching Moneyball UI tweaks."
            );
            enableBundleOverrides = Config.Bind(
                "Bundle Overrides",
                "Enabled",
                true,
                "Redirect matching FM26 bundle loads to local override files. Remove the override file or set this false to revert."
            );
            bundleOverrideDirectory = Config.Bind(
                "Bundle Overrides",
                "Directory",
                Path.Combine(Paths.ConfigPath, "MoneyballUiTweaks", "bundle-overrides"),
                "Directory containing replacement .bundle files. Files can be placed directly here by original filename."
            );
            bundleOverridesUiOnly = Config.Bind(
                "Bundle Overrides",
                "UiBundlesOnly",
                true,
                "Only redirect bundles whose filenames start with ui-."
            );
            logBundleRedirects = Config.Bind(
                "Bundle Overrides",
                "LogRedirects",
                true,
                "Log each bundle redirect the first time it is used."
            );
            enablePlayerReportTileProbe = Config.Bind(
                "Player Report",
                "EnableTileProbe",
                false,
                "Log-only experiment: probe Addressables for candidate Player Report tile/layout keys. Does not change the UI."
            );
            enablePlayerReportOverviewPerformanceBlock = Config.Bind(
                "Player Report",
                "EnableOverviewPerformanceBlock",
                false,
                "Experimental: replace the Player Report overview stats card with the loaded performance data block. Reversible by setting this false."
            );
            playerReportOverviewPerformanceBlockKey = Config.Bind(
                "Player Report",
                "OverviewPerformanceBlockKey",
                "04a6cc7bd618f09458f47d537dbb8364",
                "Addressables key for the performance data VisualTreeAsset to place in the Player Report overview stats card."
            );
            enablePlayerReportOverviewPer90LiveMove = Config.Bind(
                "Player Report",
                "EnableOverviewPer90LiveMove",
                false,
                "Experimental: move the already-bound PlayerReportPer90 tile into the Player Report overview stats card when FM has created it."
            );
            enablePlayerReportOverviewCarouselProbe = Config.Bind(
                "Player Report",
                "EnableOverviewCarouselProbe",
                false,
                "Log-only experiment: identify native Player Report overview carousel/page controls. Does not change the UI."
            );
            enablePlayerReportOverviewForceSecondCarouselPage = Config.Bind(
                "Player Report",
                "EnableOverviewForceSecondCarouselPage",
                false,
                "Experimental: click the native Player Report overview card's second carousel page once, then block the carousel controls."
            );
            lockPlayerReportOverviewStatsCarousel = Config.Bind(
                "Player Report",
                "LockOverviewStatsCarousel",
                true,
                "Hide and block the Player Report overview stats carousel controls so the Moneyball default stays selected."
            );

            BundleOverrideState.Init(
                Log,
                enableBundleOverrides.Value,
                bundleOverrideDirectory.Value,
                bundleOverridesUiOnly.Value,
                logBundleRedirects.Value
            );
            if (enableBundleOverrides.Value)
            {
                PatchBundleLoading();
            }

            ClassInjector.RegisterTypeInIl2Cpp<MoneyballUiTweaksBehaviour>();
            var go = new GameObject("Moneyball UI Tweaks");
            UnityEngine.Object.DontDestroyOnLoad(go);
            var behaviour = go.AddComponent<MoneyballUiTweaksBehaviour>();
            behaviour.Init(
                Log,
                hideIndividualTrainingProgressGraph.Value,
                scanIntervalSeconds.Value,
                enablePlayerReportTileProbe.Value,
                enablePlayerReportOverviewPerformanceBlock.Value,
                playerReportOverviewPerformanceBlockKey.Value,
                enablePlayerReportOverviewPer90LiveMove.Value,
                enablePlayerReportOverviewCarouselProbe.Value,
                enablePlayerReportOverviewForceSecondCarouselPage.Value,
                lockPlayerReportOverviewStatsCarousel.Value
            );
            Log.LogInfo("Moneyball UI Tweaks loaded.");
        }

        private void PatchBundleLoading()
        {
            Directory.CreateDirectory(bundleOverrideDirectory.Value);

            harmony = new Harmony(PluginGuid);
            MethodInfo prefix = typeof(BundleOverridePatches).GetMethod(
                nameof(BundleOverridePatches.LoadFromFilePrefix),
                BindingFlags.Public | BindingFlags.Static
            );

            int patched = 0;
            foreach (MethodInfo method in typeof(AssetBundle).GetMethods(BindingFlags.Public | BindingFlags.Static))
            {
                if (method.Name != nameof(AssetBundle.LoadFromFile)
                    && method.Name != nameof(AssetBundle.LoadFromFileAsync)) continue;
                ParameterInfo[] parameters = method.GetParameters();
                if (parameters.Length < 1 || parameters[0].ParameterType != typeof(string)) continue;

                try
                {
                    harmony.Patch(method, prefix: new HarmonyMethod(prefix));
                    patched += 1;
                }
                catch (Exception ex)
                {
                    Log.LogWarning("Could not patch AssetBundle " + method.Name + " overload " + method + ": " + ex.Message);
                }
            }

            Log.LogInfo("Bundle override loader patched " + patched + " AssetBundle file-load overload(s). Override directory: " + bundleOverrideDirectory.Value);
        }
    }

    public static class BundleOverridePatches
    {
        public static void LoadFromFilePrefix(ref string path)
        {
            BundleOverrideState.TryRedirect(ref path);
        }
    }

    public static class BundleOverrideState
    {
        private static ManualLogSource logger;
        private static bool enabled;
        private static string overrideDirectory;
        private static bool uiOnly;
        private static bool logRedirects;
        private static readonly System.Collections.Generic.HashSet<string> loggedPaths = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public static void Init(ManualLogSource source, bool isEnabled, string directory, bool onlyUiBundles, bool shouldLogRedirects)
        {
            logger = source;
            enabled = isEnabled;
            overrideDirectory = directory;
            uiOnly = onlyUiBundles;
            logRedirects = shouldLogRedirects;
        }

        public static void TryRedirect(ref string path)
        {
            if (!enabled || string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(overrideDirectory)) return;

            string fileName;
            try
            {
                fileName = Path.GetFileName(path);
            }
            catch
            {
                return;
            }

            if (string.IsNullOrEmpty(fileName) || !fileName.EndsWith(".bundle", StringComparison.OrdinalIgnoreCase)) return;
            if (uiOnly && !fileName.StartsWith("ui-", StringComparison.OrdinalIgnoreCase)) return;

            string directOverride = Path.Combine(overrideDirectory, fileName);
            if (!File.Exists(directOverride)) return;

            string originalPath = path;
            path = directOverride;

            if (logRedirects && loggedPaths.Add(originalPath))
            {
                logger?.LogInfo("Redirecting bundle load: " + originalPath + " -> " + directOverride);
            }
        }
    }

    public sealed class MoneyballUiTweaksBehaviour : MonoBehaviour
    {
        private const string ProgressReportAncestor = "TrainingProgressReport";
        private const string LineChartName = "data_display-graphs-tile-line_chart";
        private const string AxisName = "data_display-graphs-tile_elements-x_y_axis";
        private const string DialogLineChartName = "data_display-graphs-line_chart";
        private const string DialogAxisName = "data_display-graphs-elements-x_y_axis";
        private const string OverviewStatsCardName = "card states-player stats";
        private const string OverviewPerformanceBlockName = "MoneyballPlayerReportPerformanceBlock";
        private const string PlayerReportPer90Name = "PlayerReportPer90";
        private const string OverviewPer90LiveMoveName = "MoneyballPlayerReportPer90LiveMove";
        private const string OverviewCarouselBlockerName = "MoneyballOverviewCarouselBlocker";

        private ManualLogSource logger;
        private bool hideProgressGraph;
        private float scanIntervalSeconds;
        private bool enableTileProbe;
        private bool enableOverviewPerformanceBlock;
        private bool enableOverviewPer90LiveMove;
        private bool enableOverviewCarouselProbe;
        private bool enableOverviewForceSecondCarouselPage;
        private bool lockOverviewStatsCarousel;
        private string overviewPerformanceBlockKey;
        private float nextScanTime;
        private float tileProbeTime;
        private int hiddenCount;
        private int overviewSwapCount;
        private int overviewLiveMoveCount;
        private int overviewCarouselControlsHiddenCount;
        private bool faulted;
        private bool tileProbeDone;
        private VisualTreeAsset overviewPerformanceBlockAsset;
        private bool overviewPerformanceBlockLoadAttempted;
        private VisualElement cachedPlayerReportPer90;
        private float cachedPlayerReportPer90Time;
        private readonly System.Collections.Generic.HashSet<string> overviewCarouselProbeLogged = new System.Collections.Generic.HashSet<string>();
        private readonly System.Collections.Generic.HashSet<int> overviewCarouselClickedCards = new System.Collections.Generic.HashSet<int>();

        public MoneyballUiTweaksBehaviour(IntPtr ptr) : base(ptr)
        {
        }

        public void Init(
            ManualLogSource source,
            bool hideGraph,
            float intervalSeconds,
            bool probeTiles,
            bool swapOverviewPerformanceBlock,
            string performanceBlockKey,
            bool moveLivePer90,
            bool probeOverviewCarousel,
            bool forceSecondCarouselPage,
            bool lockStatsCarousel
        )
        {
            logger = source;
            hideProgressGraph = hideGraph;
            scanIntervalSeconds = Math.Max(0.2f, intervalSeconds);
            enableTileProbe = probeTiles;
            enableOverviewPerformanceBlock = swapOverviewPerformanceBlock;
            overviewPerformanceBlockKey = performanceBlockKey;
            enableOverviewPer90LiveMove = moveLivePer90;
            enableOverviewCarouselProbe = probeOverviewCarousel;
            enableOverviewForceSecondCarouselPage = forceSecondCarouselPage;
            lockOverviewStatsCarousel = lockStatsCarousel;
            tileProbeTime = Time.realtimeSinceStartup + 10f;
        }

        private void Update()
        {
            if (faulted) return;
            if (enableTileProbe && !tileProbeDone && Time.realtimeSinceStartup >= tileProbeTime)
            {
                tileProbeDone = true;
                ProbePlayerReportTiles();
            }

            if (!hideProgressGraph
                && !enableOverviewPerformanceBlock
                && !enableOverviewPer90LiveMove
                && !enableOverviewCarouselProbe
                && !enableOverviewForceSecondCarouselPage
                && !lockOverviewStatsCarousel) return;
            if (Time.realtimeSinceStartup < nextScanTime) return;
            nextScanTime = Time.realtimeSinceStartup + scanIntervalSeconds;

            try
            {
                ScanDocuments();
            }
            catch (Exception ex)
            {
                faulted = true;
                logger?.LogError("Moneyball UI Tweaks disabled after scan failure: " + ex);
            }
        }

        private void ScanDocuments()
        {
            UIDocument[] documents = UnityEngine.Object.FindObjectsOfType<UIDocument>();
            foreach (var document in documents)
            {
                if (document == null || document.rootVisualElement == null) continue;
                if (hideProgressGraph)
                {
                    HideMatches(document.rootVisualElement, false);
                }
                if (enableOverviewPerformanceBlock)
                {
                    ApplyOverviewPerformanceBlock(document.rootVisualElement);
                }
                if (enableOverviewPer90LiveMove)
                {
                    CapturePlayerReportPer90(document.rootVisualElement);
                    ApplyOverviewPer90LiveMove(document.rootVisualElement);
                }
                if (enableOverviewCarouselProbe)
                {
                    ProbeOverviewCarousel(document.rootVisualElement);
                }
                if (enableOverviewForceSecondCarouselPage)
                {
                    ForceOverviewSecondCarouselPage(document.rootVisualElement);
                }
                if (lockOverviewStatsCarousel)
                {
                    LockOverviewStatsCarousel(document.rootVisualElement);
                }
            }
        }

        private void HideMatches(VisualElement element, bool inProgressReport)
        {
            if (element == null) return;

            bool scoped = inProgressReport || element.name == ProgressReportAncestor || IsProgressReportDialogRoot(element);
            if (scoped && IsProgressGraphElement(element))
            {
                HideElement(element);
                return;
            }

            if (!scoped && IsProgressGraphElement(element) && IsLargeDialogGraph(element))
            {
                HideElement(element);
                return;
            }

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                HideMatches(element.ElementAt(i), scoped);
            }
        }

        private bool IsProgressGraphElement(VisualElement element)
        {
            string name = element.name ?? "";
            return name == LineChartName
                || name == AxisName
                || name == DialogLineChartName
                || name == DialogAxisName
                || (name.Contains("data_display-graphs") && name.Contains("line_chart"))
                || (name.Contains("data_display-graphs") && name.Contains("x_y_axis"));
        }

        private bool IsProgressReportDialogRoot(VisualElement element)
        {
            string name = element.name ?? "";
            if (name.Contains("TrainingProgressReport") || name.Contains("ProgressReport")) return true;

            // The expanded card is a dialog, and the progress chart is the only large
            // line-chart block we want to suppress inside that focused overlay.
            if (!name.Contains("Progress")) return false;
            return HasDescendantNamed(element, "Ability") || HasDescendantNamed(element, "Attributes");
        }

        private bool IsLargeDialogGraph(VisualElement element)
        {
            Rect rect = element.worldBound;
            if (rect.width < 500 || rect.height < 100) return false;
            return HasAncestorNamedLike(element, "Dialog")
                || HasAncestorNamedLike(element, "Modal")
                || HasAncestorNamedLike(element, "Progress")
                || HasAncestorNamedLike(element, "Report");
        }

        private bool HasAncestorNamedLike(VisualElement element, string text)
        {
            VisualElement current = element?.parent;
            while (current != null)
            {
                if ((current.name ?? "").IndexOf(text, StringComparison.OrdinalIgnoreCase) >= 0) return true;
                current = current.parent;
            }
            return false;
        }

        private bool HasDescendantNamed(VisualElement element, string name)
        {
            if (element == null) return false;
            if (element.name == name) return true;
            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                if (HasDescendantNamed(element.ElementAt(i), name)) return true;
            }
            return false;
        }

        private void HideElement(VisualElement element)
        {
            if (element == null) return;
            if (element.resolvedStyle.display == DisplayStyle.None) return;

            element.style.display = DisplayStyle.None;
            hiddenCount += 1;
            if (hiddenCount <= 10 || hiddenCount % 25 == 0)
            {
                logger?.LogInfo("Hidden Individual Training Progress Report graph element: " + element.name);
            }
        }

        private void ProbePlayerReportTiles()
        {
            string[] visualTreeKeys =
            {
                "PlayerPerformanceDataBlock_16x8.uxml",
                "5e246c72b5b8619478db9a107da15075",
                "RadarPolygonGraphTile_4x2.uxml",
                "04a6cc7bd618f09458f47d537dbb8364",
                "PlayerPerformanceDataBlock_12x8.uxml",
                "ce35188c0873adc408a0b0ee0e238098",
                "PlayerPerformanceDataBlock_8x8.uxml",
                "7a450ec28b5ca1d4cab3c9b90a5e43c7",
                "PlayerPerformanceDataTile_4x2.uxml",
                "7ae8007f879021a47b160dd16f20d2d3",
                "PlayerPerformanceDataTile_8x4.uxml",
                "84eaa793dd3bb7241ba52352fd21f432",
                "PlayerSeasonStatsTile_8x2.uxml",
                "c83093f833e6cfb48bc57d548176a9ce",
                "PlayerSeasonStatsTile_8x4.uxml",
                "887aed327363be541aee00483b446fda",
                "PlayerSeasonStatsTile_4x4.uxml"
            };

            string[] objectKeys =
            {
                "PlayerReportPerformanceTileSet.asset",
                "e3577ed438960de4d95ee30c47725c11",
                "PlayerReportPerformanceCompositionSet.asset",
                "325ea01ec23fc1d4795c3324ce1cf17f",
                "PlayerReportPerformance-Standard.asset",
                "32db7e1cb47ffc64999c9a3d3fdfc5e5",
                "PlayerReportPerformance-Large.asset",
                "f3d47af0effad734da2f77f656c31749",
                "PlayerReportPerformanceIM-Standard.asset",
                "760bd8ab988528b489da1fee5d7c4a00",
                "PlayerReportPerformanceIM-Large.asset",
                "f3c8bdaf80e0a434194ede7277da3015",
                "PlayerReportOverviewGridCompositionSet.asset",
                "PlayerReportOverviewGridComposition-Standard.asset",
                "PlayerReportOverviewGridElementSet.asset",
                "NonPlayerReportOverviewGridCompositionSet.asset",
                "0758d2d394dc7f84281b44b55d09edce",
                "NonPlayerReportOverviewGridComposition-Standard.asset",
                "4857a10bf7d0ca84c9b1f944bef0584e5",
                "NonPlayerReportOverviewGridElementSet.asset",
                "26779ad09b5bf0f4e88ad6179cb360682"
            };

            logger?.LogInfo("Player Report tile probe starting.");
            foreach (string key in visualTreeKeys)
            {
                ProbeAddressable<VisualTreeAsset>(key);
            }
            foreach (string key in objectKeys)
            {
                ProbeAddressable<UnityEngine.Object>(key);
            }
            logger?.LogInfo("Player Report tile probe finished.");
        }

        private void ProbeAddressable<TObject>(string key) where TObject : UnityEngine.Object
        {
            try
            {
                AsyncOperationHandle<TObject> handle = Addressables.LoadAssetAsync<TObject>(key);
                TObject result = handle.WaitForCompletion();
                AsyncOperationStatus status = handle.Status;
                string resultName = result == null ? "(null)" : result.name;
                logger?.LogInfo("Addressables probe: " + key + " as " + typeof(TObject).Name + " -> " + status + " / " + resultName);
                Addressables.Release(handle);
            }
            catch (Exception ex)
            {
                logger?.LogInfo("Addressables probe failed: " + key + " as " + typeof(TObject).Name + " -> " + ex.GetType().Name + ": " + ex.Message);
            }
        }

        private void ApplyOverviewPerformanceBlock(VisualElement root)
        {
            VisualElement statsCard = FindElementByName(root, OverviewStatsCardName);
            if (statsCard == null) return;
            if (!HasAncestorNamedLike(statsCard, "PlayerReport")) return;
            if (HasDirectChildNamed(statsCard, OverviewPerformanceBlockName)) return;

            VisualTreeAsset asset = LoadOverviewPerformanceBlockAsset();
            if (asset == null) return;

            TemplateContainer clone = asset.CloneTree();
            clone.name = OverviewPerformanceBlockName;
            clone.style.flexGrow = 1;
            clone.style.width = Length.Percent(100);
            clone.style.height = Length.Percent(100);

            int childCount = statsCard.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                VisualElement child = statsCard.ElementAt(i);
                if (child == null) continue;
                child.style.display = DisplayStyle.None;
            }

            statsCard.Add(clone);
            overviewSwapCount += 1;
            logger?.LogInfo("Applied Player Report overview performance block swap using key " + overviewPerformanceBlockKey + " (count " + overviewSwapCount + ").");
        }

        private VisualTreeAsset LoadOverviewPerformanceBlockAsset()
        {
            if (overviewPerformanceBlockAsset != null) return overviewPerformanceBlockAsset;
            if (overviewPerformanceBlockLoadAttempted) return null;
            overviewPerformanceBlockLoadAttempted = true;

            try
            {
                AsyncOperationHandle<VisualTreeAsset> handle = Addressables.LoadAssetAsync<VisualTreeAsset>(overviewPerformanceBlockKey);
                overviewPerformanceBlockAsset = handle.WaitForCompletion();
                logger?.LogInfo("Overview performance block load: " + overviewPerformanceBlockKey + " -> " + handle.Status + " / " + (overviewPerformanceBlockAsset == null ? "(null)" : overviewPerformanceBlockAsset.name));
                Addressables.Release(handle);
            }
            catch (Exception ex)
            {
                logger?.LogInfo("Overview performance block load failed: " + overviewPerformanceBlockKey + " -> " + ex.GetType().Name + ": " + ex.Message);
                overviewPerformanceBlockAsset = null;
            }

            return overviewPerformanceBlockAsset;
        }

        private void CapturePlayerReportPer90(VisualElement root)
        {
            VisualElement per90 = FindElementByName(root, PlayerReportPer90Name);
            if (per90 == null) return;
            if (HasAncestorNamedLike(per90, OverviewPer90LiveMoveName)) return;
            if (cachedPlayerReportPer90 == per90) return;

            cachedPlayerReportPer90 = per90;
            cachedPlayerReportPer90Time = Time.realtimeSinceStartup;
            logger?.LogInfo("Captured live PlayerReportPer90 tile for overview move.");
        }

        private void ApplyOverviewPer90LiveMove(VisualElement root)
        {
            VisualElement statsCard = FindElementByName(root, OverviewStatsCardName);
            if (statsCard == null) return;
            if (!HasAncestorNamedLike(statsCard, "PlayerReport")) return;
            EnsureOverviewCarouselBlocker(root, statsCard);
            if (HasDirectChildNamed(statsCard, OverviewPer90LiveMoveName)) return;

            VisualElement per90 = cachedPlayerReportPer90;
            if (per90 == null || per90.parent == null) return;
            if (per90 == statsCard || IsDescendantOf(per90, statsCard) || IsDescendantOf(statsCard, per90)) return;
            if (Time.realtimeSinceStartup - cachedPlayerReportPer90Time < 1.5f) return;

            int childCount = statsCard.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                VisualElement child = statsCard.ElementAt(i);
                if (child == null) continue;
                child.style.display = DisplayStyle.None;
            }

            VisualElement wrapper = new VisualElement();
            wrapper.name = OverviewPer90LiveMoveName;
            FitMovedPer90ToOverviewCard(wrapper);

            per90.RemoveFromHierarchy();
            FitMovedPer90ToOverviewCard(per90);
            wrapper.Add(per90);
            statsCard.Add(wrapper);

            overviewLiveMoveCount += 1;
            logger?.LogInfo("Moved live PlayerReportPer90 tile into overview stats card (count " + overviewLiveMoveCount + ").");
        }

        private void LockOverviewStatsCarousel(VisualElement root)
        {
            VisualElement statsHost = FindElementByName(root, OverviewStatsCardName);
            if (statsHost == null)
            {
                statsHost = FindElementByName(root, PlayerReportPer90Name);
            }
            if (statsHost == null) return;
            if (!HasAncestorNamedLike(statsHost, "PlayerReport")) return;
            if (enableOverviewForceSecondCarouselPage && !overviewCarouselClickedCards.Contains(statsHost.GetHashCode())) return;

            DisableOverviewStatsCarouselControls(root, statsHost);
            EnsureOverviewCarouselBlocker(root, statsHost);
        }

        private void DisableOverviewStatsCarouselControls(VisualElement root, VisualElement statsCard)
        {
            Rect cardRect = statsCard.worldBound;
            if (cardRect.width <= 0 || cardRect.height <= 0) return;

            DisableOverviewStatsCarouselControls(root, cardRect);
        }

        private void DisableOverviewStatsCarouselControls(VisualElement element, Rect cardRect)
        {
            if (element == null) return;
            if (element.name == OverviewCarouselBlockerName) return;

            Rect rect = element.worldBound;
            string name = element.name ?? "";
            bool excludedName = name.IndexOf("Fixture", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Result", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Venue", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Icon", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("cell", StringComparison.OrdinalIgnoreCase) >= 0;
            bool dotSized = rect.width >= 5
                && rect.height >= 5
                && rect.width <= 32
                && rect.height <= 32
                && rect.width / rect.height >= 0.65f
                && rect.width / rect.height <= 1.55f;
            bool suspiciousName = name.IndexOf("carousel", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("page", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("dot", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("toggle", StringComparison.OrdinalIgnoreCase) >= 0;
            bool nearTopRight = !excludedName
                && rect.width > 0
                && rect.height > 0
                && rect.width <= 64
                && rect.height <= 40
                && rect.xMin >= cardRect.xMax - 120
                && rect.xMax <= cardRect.xMax + 24
                && rect.yMin >= cardRect.yMin - 28
                && rect.yMin <= cardRect.yMin + 56
                && (dotSized || suspiciousName);

            if (nearTopRight)
            {
                element.pickingMode = PickingMode.Ignore;
                element.style.display = DisplayStyle.None;
                element.style.opacity = 0;
                overviewCarouselControlsHiddenCount += 1;
                if (overviewCarouselControlsHiddenCount <= 12)
                {
                    logger?.LogInfo("Hidden Player Report overview carousel control: " + (element.name ?? "(unnamed)") + " bounds=" + rect);
                }
                return;
            }

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                DisableOverviewStatsCarouselControls(element.ElementAt(i), cardRect);
            }
        }

        private void EnsureOverviewCarouselBlocker(VisualElement root, VisualElement statsCard)
        {
            Rect rootRect = root.worldBound;
            Rect cardRect = statsCard.worldBound;
            if (rootRect.width <= 0 || rootRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return;

            VisualElement blocker = FindElementByName(root, OverviewCarouselBlockerName);
            if (blocker == null)
            {
                blocker = new VisualElement();
                blocker.name = OverviewCarouselBlockerName;
                blocker.pickingMode = PickingMode.Position;
                blocker.style.position = Position.Absolute;
                blocker.style.backgroundColor = Color.clear;
                root.Add(blocker);
                logger?.LogInfo("Added Player Report overview carousel click blocker.");
            }

            blocker.style.display = DisplayStyle.Flex;
            blocker.style.left = cardRect.xMax - rootRect.xMin - 78;
            blocker.style.top = cardRect.yMin - rootRect.yMin - 18;
            blocker.style.width = 92;
            blocker.style.height = 42;
        }

        private void ForceOverviewSecondCarouselPage(VisualElement root)
        {
            VisualElement statsCard = FindElementByName(root, OverviewStatsCardName);
            if (statsCard == null) return;
            if (!HasAncestorNamedLike(statsCard, "PlayerReport")) return;

            Rect cardRect = statsCard.worldBound;
            if (cardRect.width <= 0 || cardRect.height <= 0) return;

            int key = statsCard.GetHashCode();
            if (overviewCarouselClickedCards.Contains(key))
            {
                EnsureOverviewCarouselBlocker(root, statsCard);
                return;
            }

            if (Time.realtimeSinceStartup < 3f) return;

            VisualElement target = FindOverviewSecondCarouselTarget(root, cardRect);
            if (target == null || target == root)
            {
                if (overviewCarouselProbeLogged.Add("force-second-no-target|" + key))
                {
                    logger?.LogInfo("Could not find a native Player Report overview second carousel dot to click.");
                }
                return;
            }

            Rect targetRect = target.worldBound;
            Vector2 clickPosition = new Vector2(targetRect.center.x, targetRect.center.y);

            if (SendSyntheticClickChain(target, clickPosition))
            {
                overviewCarouselClickedCards.Add(key);
                EnsureOverviewCarouselBlocker(root, statsCard);
                logger?.LogInfo("Clicked native Player Report overview second carousel page target=" + (target.name ?? "(unnamed)") + " at " + clickPosition + ".");
            }
        }

        private VisualElement FindOverviewSecondCarouselTarget(VisualElement root, Rect cardRect)
        {
            VisualElement best = null;
            float bestCenterX = float.MinValue;
            FindOverviewSecondCarouselTarget(root, cardRect, ref best, ref bestCenterX);
            return best;
        }

        private void FindOverviewSecondCarouselTarget(VisualElement element, Rect cardRect, ref VisualElement best, ref float bestCenterX)
        {
            if (element == null || element.name == OverviewCarouselBlockerName) return;

            Rect rect = element.worldBound;
            string name = element.name ?? "";
            bool excludedName = name.IndexOf("Fixture", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Result", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Venue", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0;
            bool nearDots = rect.width > 0
                && rect.height > 0
                && rect.xMin >= cardRect.xMax - 170
                && rect.xMax <= cardRect.xMax + 32
                && rect.yMin >= cardRect.yMin - 72
                && rect.yMax <= cardRect.yMin + 88;
            bool dotSized = rect.width >= 5
                && rect.height >= 5
                && rect.width <= 42
                && rect.height <= 42
                && rect.width / rect.height >= 0.65f
                && rect.width / rect.height <= 1.55f;
            bool dotNamed = name.IndexOf("carousel", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("page", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("dot", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("toggle", StringComparison.OrdinalIgnoreCase) >= 0;

            if (!excludedName && nearDots && (dotSized || dotNamed))
            {
                float score = rect.center.x - Math.Abs(rect.center.y - (cardRect.yMin - 2f)) * 8f;
                if (score > bestCenterX)
                {
                    best = element;
                    bestCenterX = score;
                }
            }

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                FindOverviewSecondCarouselTarget(element.ElementAt(i), cardRect, ref best, ref bestCenterX);
            }
        }

        private bool SendSyntheticClickChain(VisualElement target, Vector2 worldPosition)
        {
            bool sent = false;
            int depth = 0;
            VisualElement current = target;
            string path = "";

            while (current != null && depth < 8)
            {
                Rect rect = current.worldBound;
                if (rect.width > 260 || rect.height > 140) break;

                string name = current.name ?? "";
                if (!string.IsNullOrEmpty(name))
                {
                    path = string.IsNullOrEmpty(path) ? name : path + " > " + name;
                }

                sent = SendSyntheticClick(current, worldPosition) || sent;
                current = current.parent;
                depth += 1;
            }

            logger?.LogInfo("Native overview carousel click chain sent=" + sent + " depth=" + depth + " path=" + (string.IsNullOrEmpty(path) ? "(unnamed chain)" : path) + ".");
            return sent;
        }

        private bool SendSyntheticClick(VisualElement target, Vector2 worldPosition)
        {
            try
            {
                MouseDownEvent mouseDown = MouseDownEvent.GetPooled();
                mouseDown.mousePosition = worldPosition;
                mouseDown.localMousePosition = target.WorldToLocal(worldPosition);
                mouseDown.button = 0;
                mouseDown.pressedButtons = 1;
                mouseDown.clickCount = 1;
                target.SendEvent(mouseDown);

                MouseUpEvent mouseUp = MouseUpEvent.GetPooled();
                mouseUp.mousePosition = worldPosition;
                mouseUp.localMousePosition = target.WorldToLocal(worldPosition);
                mouseUp.button = 0;
                mouseUp.pressedButtons = 0;
                mouseUp.clickCount = 1;
                target.SendEvent(mouseUp);

                ClickEvent click = ClickEvent.GetPooled();
                target.SendEvent(click);

                return true;
            }
            catch (Exception ex)
            {
                logger?.LogInfo("Native overview carousel synthetic click failed: " + ex.GetType().Name + ": " + ex.Message);
                return false;
            }
        }

        private void FitMovedPer90ToOverviewCard(VisualElement element)
        {
            if (element == null) return;

            element.style.display = DisplayStyle.Flex;
            element.style.flexGrow = 1;
            element.style.flexShrink = 1;
            element.style.width = Length.Percent(100);
            element.style.height = Length.Percent(100);
            element.style.maxHeight = Length.Percent(100);
            element.style.minHeight = 0;
            element.style.alignSelf = Align.Stretch;
            element.style.overflow = Overflow.Hidden;
            element.style.fontSize = 14;

            FitMovedPer90Children(element);
        }

        private void FitMovedPer90Children(VisualElement element)
        {
            if (element == null) return;

            string name = element.name ?? "";
            if (name.Contains("Content") || name.Contains("Frame") || name.Contains("PlayerReport") || name.Contains("RadarPolygonGraph"))
            {
                element.style.flexGrow = 1;
                element.style.flexShrink = 1;
                element.style.maxHeight = Length.Percent(100);
                element.style.minHeight = 0;
                element.style.overflow = Overflow.Hidden;
            }

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                FitMovedPer90Children(element.ElementAt(i));
            }
        }

        private void ProbeOverviewCarousel(VisualElement root)
        {
            VisualElement statsCard = FindElementByName(root, OverviewStatsCardName);
            if (statsCard == null) return;
            if (!HasAncestorNamedLike(statsCard, "PlayerReport")) return;

            Rect cardRect = statsCard.worldBound;
            if (cardRect.width <= 0 || cardRect.height <= 0) return;

            ProbeOverviewCarousel(root, cardRect, "");
        }

        private void ProbeOverviewCarousel(VisualElement element, Rect cardRect, string path)
        {
            if (element == null) return;

            string name = element.name ?? "";
            string nextPath = string.IsNullOrEmpty(name) ? path : (string.IsNullOrEmpty(path) ? name : path + " > " + name);
            Rect rect = element.worldBound;
            bool nearTopRight = rect.width > 0
                && rect.height > 0
                && rect.xMin >= cardRect.xMax - 180
                && rect.xMax <= cardRect.xMax + 48
                && rect.yMin >= cardRect.yMin - 60
                && rect.yMin <= cardRect.yMin + 130;
            bool dotSized = rect.width <= 90 && rect.height <= 90;
            bool suspiciousName = name.IndexOf("carousel", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("page", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("switch", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("dot", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("toggle", StringComparison.OrdinalIgnoreCase) >= 0;

            if (nearTopRight && (dotSized || suspiciousName))
            {
                string key = name + "|" + Mathf.RoundToInt(rect.xMin) + "|" + Mathf.RoundToInt(rect.yMin) + "|" + Mathf.RoundToInt(rect.width) + "|" + Mathf.RoundToInt(rect.height);
                if (overviewCarouselProbeLogged.Add(key) && overviewCarouselProbeLogged.Count <= 80)
                {
                    logger?.LogInfo("Overview carousel probe candidate: name=" + (string.IsNullOrEmpty(name) ? "(unnamed)" : name) + " bounds=" + rect + " path=" + nextPath);
                }
            }

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                ProbeOverviewCarousel(element.ElementAt(i), cardRect, nextPath);
            }
        }

        private VisualElement FindElementByName(VisualElement element, string name)
        {
            if (element == null) return null;
            if (element.name == name) return element;

            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                VisualElement found = FindElementByName(element.ElementAt(i), name);
                if (found != null) return found;
            }

            return null;
        }

        private bool HasDirectChildNamed(VisualElement element, string name)
        {
            if (element == null) return false;
            int childCount = element.childCount;
            for (int i = 0; i < childCount; i += 1)
            {
                VisualElement child = element.ElementAt(i);
                if (child != null && child.name == name) return true;
            }
            return false;
        }

        private bool IsDescendantOf(VisualElement element, VisualElement ancestor)
        {
            if (element == null || ancestor == null) return false;
            VisualElement current = element.parent;
            while (current != null)
            {
                if (current == ancestor) return true;
                current = current.parent;
            }
            return false;
        }
    }
}
