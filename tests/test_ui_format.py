#!/usr/bin/env python3
"""
Unit tests verifying the ui.format schema and icon.jpeg asset integrity across the application.
"""

import json
import os
import unittest


class TestUIFormatSchema(unittest.TestCase):
    def setUp(self):
        self.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.schema_path = os.path.join(self.root_dir, 'ui.format.json')
        self.icon_path = os.path.join(self.root_dir, 'icon.jpeg')
        self.index_path = os.path.join(self.root_dir, 'index.html')
        self.styles_path = os.path.join(self.root_dir, 'css', 'styles.css')
        self.ui_js_path = os.path.join(self.root_dir, 'src', 'ui.js')
        self.auth_ui_path = os.path.join(self.root_dir, 'src', 'auth-ui.js')
        self.team_ui_path = os.path.join(self.root_dir, 'src', 'team-manager-ui.js')
        self.ui_format_js_path = os.path.join(self.root_dir, 'src', 'ui-format.js')
        self.manifest_path = os.path.join(self.root_dir, 'manifest.json')
        self.sw_path = os.path.join(self.root_dir, 'sw.js')
        self.icon_192_path = os.path.join(self.root_dir, 'icon-192.png')
        self.icon_512_path = os.path.join(self.root_dir, 'icon-512.png')
        self.apple_touch_icon_path = os.path.join(self.root_dir, 'apple-touch-icon.png')

    def test_icon_jpeg_exists_and_valid(self):
        """icon.jpeg must exist and be non-empty with JPEG magic bytes."""
        self.assertTrue(os.path.exists(self.icon_path), "icon.jpeg must exist in the root directory")
        size = os.path.getsize(self.icon_path)
        self.assertGreater(size, 10000, "icon.jpeg should be a high-resolution asset")

        # Verify JPEG magic bytes FF D8 FF
        with open(self.icon_path, 'rb') as f:
            header = f.read(3)
            self.assertEqual(header, b'\xff\xd8\xff', "icon.jpeg must have standard JPEG magic bytes")

    def test_ui_format_json_structure(self):
        """ui.format.json must be valid JSON containing brand, palette, and typography schemas."""
        self.assertTrue(os.path.exists(self.schema_path), "ui.format.json must exist in root")
        with open(self.schema_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.assertIn('$schema', data)
        self.assertIn('brand', data)
        self.assertIn('palette', data)
        self.assertIn('typography', data)
        self.assertIn('components', data)
        self.assertIn('validationRules', data)

        # Check brand specifics
        brand = data['brand']
        self.assertEqual(brand.get('name'), 'dugout-admin')
        self.assertIn('logo', brand)
        logo = brand['logo']
        self.assertEqual(logo.get('assetPath'), 'icon.jpeg')
        self.assertEqual(logo.get('shape'), 'squircle')
        self.assertEqual(logo.get('dimensions', {}).get('aspectRatio'), '1:1')

        # Check required palette keys
        palette = data['palette']
        self.assertIn('brandOrange', palette)
        self.assertIn('shieldBlue', palette)
        self.assertIn('fieldGreen', palette)
        self.assertIn('infieldDirt', palette)
        self.assertIn('baseballRed', palette)

        # Check validation rules
        rules = data['validationRules']
        self.assertIn('logoIntegrity', rules)
        self.assertEqual(rules['logoIntegrity'].get('requiredAspectRatio'), '1:1')

    def test_index_html_includes_logo(self):
        """index.html must include icon.jpeg as favicon, apple-touch-icon, and splash loader."""
        with open(self.index_path, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn('href="icon.jpeg"', content, "index.html must link icon.jpeg for favicon/icons")
        self.assertIn('src="icon.jpeg"', content, "index.html must display icon.jpeg in loading splash")

    def test_ui_components_include_logo(self):
        """Main UI and Auth components must reference icon.jpeg."""
        with open(self.ui_js_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()
        self.assertIn('src="icon.jpeg"', ui_content, "ui.js must render icon.jpeg in app header")
        self.assertIn('brand-logo', ui_content, "ui.js must use brand-logo class")

        with open(self.auth_ui_path, 'r', encoding='utf-8') as f:
            auth_content = f.read()
        self.assertIn('src="icon.jpeg"', auth_content, "auth-ui.js must render icon.jpeg")
        self.assertIn('auth-logo-img', auth_content, "auth-ui.js must use auth-logo-img class")

        with open(self.team_ui_path, 'r', encoding='utf-8') as f:
            team_content = f.read()
        self.assertIn('src="icon.jpeg"', team_content, "team-manager-ui.js must render icon.jpeg")
        self.assertIn('team-modal-logo', team_content, "team-manager-ui.js must use team-modal-logo class")

    def test_css_variables_and_classes(self):
        """styles.css must define brand variables and logo component styling."""
        with open(self.styles_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        self.assertIn('--brand-orange:', css_content)
        self.assertIn('--brand-shield-blue:', css_content)
        self.assertIn('--brand-field-green:', css_content)
        self.assertIn('.brand-logo', css_content)
        self.assertIn('.auth-logo-img', css_content)
        self.assertIn('.team-modal-logo', css_content)

    def test_ui_format_js_module(self):
        """src/ui-format.js must exist and export UI_FORMAT and validator."""
        self.assertTrue(os.path.exists(self.ui_format_js_path), "src/ui-format.js must exist")
        with open(self.ui_format_js_path, 'r', encoding='utf-8') as f:
            js_content = f.read()

        self.assertIn('export const UI_FORMAT', js_content)
        self.assertIn('export function validateUIFormat', js_content)
        self.assertIn('icon.jpeg', js_content)

    def test_baseball_diamond_background_and_player_format(self):
        """Field visualizer must have baseball diamond SVG background and First Name + Number format."""
        with open(self.ui_js_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()

        self.assertIn('baseball-diamond-bg', ui_content, "ui.js must include baseball-diamond-bg")
        self.assertIn('formatFieldPlayerName', ui_content, "ui.js must use formatFieldPlayerName helper")
        self.assertIn('formatFieldPlayerName(assignments.LF)', ui_content)
        self.assertIn('formatFieldPlayerName(assignments.P)', ui_content)
        self.assertIn('formatFieldPlayerName(assignments.C)', ui_content)

        with open(self.styles_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

    def test_game_layout_and_mobile_ui_unification(self):
        """Game Layout and mobile-enabled layout must have consistent navigation, typography, and card tokens."""
        with open(self.ui_js_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()

        # Check top subnav in Game Layout
        self.assertIn('game-subnav-strip', ui_content, "ui.js must include game-subnav-strip")
        self.assertIn('btn-subnav-lineup', ui_content)
        self.assertIn('btn-subnav-tracker', ui_content)
        self.assertIn('btn-taskbar-lineup', ui_content)
        self.assertIn('btn-taskbar-tracker', ui_content)

        # Check header buttons present in both modes
        self.assertIn('btn-lineup-modal', ui_content)
        self.assertIn('btn-print-card', ui_content)
        self.assertIn('btn-teams-manager', ui_content)

        with open(self.styles_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        # Check styles for subnav strip and brand typography
        self.assertIn('.game-subnav-strip', css_content)
        self.assertIn('.game-subnav-btn', css_content)
        self.assertIn('.game-card-title', css_content)
        self.assertIn('font-family: var(--font-brand);', css_content)

    def test_pwa_assets_and_service_worker(self):
        """PWA manifest, icons, service worker, and index.html tags must be configured properly."""
        # 1. Icons exist and are non-empty
        for icon_file, expected_path in [
            ('icon-192.png', self.icon_192_path),
            ('icon-512.png', self.icon_512_path),
            ('apple-touch-icon.png', self.apple_touch_icon_path)
        ]:
            self.assertTrue(os.path.exists(expected_path), f"{icon_file} must exist")
            self.assertGreater(os.path.getsize(expected_path), 1000, f"{icon_file} should have content")

        # 2. Manifest is valid JSON with required PWA attributes
        self.assertTrue(os.path.exists(self.manifest_path), "manifest.json must exist")
        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        self.assertIn('Dugout Admin', manifest.get('name'))
        self.assertEqual(manifest.get('short_name'), 'Dugout Admin')
        self.assertEqual(manifest.get('display'), 'standalone')
        self.assertEqual(manifest.get('start_url'), './index.html')
        self.assertEqual(manifest.get('scope'), './')
        self.assertEqual(manifest.get('background_color'), '#0a1120')
        self.assertEqual(manifest.get('theme_color'), '#0f172a')
        self.assertGreaterEqual(len(manifest.get('icons', [])), 2)

        # 3. Service Worker exists and handles caching
        self.assertTrue(os.path.exists(self.sw_path), "sw.js must exist")
        with open(self.sw_path, 'r', encoding='utf-8') as f:
            sw_content = f.read()

        self.assertIn('CACHE_NAME', sw_content)
        self.assertIn('PRECACHE_ASSETS', sw_content)
        self.assertIn('addEventListener(\'install\'', sw_content)
        self.assertIn('addEventListener(\'activate\'', sw_content)
        self.assertIn('addEventListener(\'fetch\'', sw_content)
        self.assertIn('manifest.json', sw_content)
        self.assertIn('icon-192.png', sw_content)
        self.assertIn('icon-512.png', sw_content)

        # 4. index.html contains PWA links & service worker registration
        with open(self.index_path, 'r', encoding='utf-8') as f:
            index_content = f.read()

        self.assertIn('<link rel="manifest" href="manifest.json">', index_content)
        self.assertIn('name="apple-mobile-web-app-capable" content="yes"', index_content)
        self.assertIn('name="apple-mobile-web-app-status-bar-style"', index_content)
        self.assertIn('navigator.serviceWorker.register', index_content)
        self.assertIn('beforeinstallprompt', index_content)

        # 5. ui.js has PWA install modal and button handlers
        with open(self.ui_js_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()

        self.assertIn('showInstallAppModal', ui_content)
        self.assertIn('btn-hub-install', ui_content)


if __name__ == '__main__':
    unittest.main()

