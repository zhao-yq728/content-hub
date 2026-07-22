#!/usr/bin/env python3
"""CDP 抓取代理启动脚本 — 跨平台 Win/Mac/Linux
自动检测浏览器并启动调试模式，然后启动 Node.js 代理服务器"""

import os
import sys
import platform
import subprocess
import time

CDP_PORT = 9222
PROXY_PORT = 3457

def find_browser():
    """检测已安装的浏览器"""
    system = platform.system()
    browsers = []
    
    if system == 'Darwin':  # macOS
        paths = [
            ('Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
            ('Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
            ('Chromium', '/Applications/Chromium.app/Contents/MacOS/Chromium'),
        ]
    elif system == 'Windows':
        paths = [
            ('Edge', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
            ('Chrome', r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
            ('Chrome_x86', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'),
        ]
    else:  # Linux
        paths = [
            ('Chrome', '/usr/bin/google-chrome'),
            ('Chromium', '/usr/bin/chromium-browser'),
            ('Edge', '/usr/bin/microsoft-edge'),
        ]
    
    for name, path in paths:
        if os.path.exists(path):
            browsers.append((name, path))
    return browsers

def start_browser(path, name):
    """启动浏览器并开启远程调试"""
    system = platform.system()
    
    if system == 'Darwin':
        cmd = [path, f'--remote-debugging-port={CDP_PORT}', '--no-first-run',
               '--no-default-browser-check', 'https://www.xiaohongshu.com']
        print(f'启动 {name} (macOS)...')
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        cmd = [path, f'--remote-debugging-port={CDP_PORT}', '--no-first-run',
               '--no-default-browser-check', 'https://www.xiaohongshu.com']
        print(f'启动 {name}...')
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 等待浏览器启动
    time.sleep(5)
    
    # 验证 CDP 端口
    import urllib.request
    try:
        resp = urllib.request.urlopen(f'http://localhost:{CDP_PORT}/json/version', timeout=3)
        data = resp.read().decode()
        if 'Browser' in data:
            print(f'✓ {name} 已启动 (CDP 端口 {CDP_PORT})')
            return True
    except:
        pass
    
    print(f'⚠ {name} 可能未正确启动，请手动开启调试模式')
    return False

def main():
    print('=' * 50)
    print('  CDP 内容抓取代理 — 启动器')
    print('  支持: 小红书 · 抖音 · 公众号 · 微博 · 知乎 · B站')
    print('=' * 50)
    
    browsers = find_browser()
    if not browsers:
        print('✗ 未检测到支持的浏览器 (Chrome/Edge/Chromium)')
        print('  请手动启动浏览器并添加参数: --remote-debugging-port=' + str(CDP_PORT))
        sys.exit(1)
    
    print(f'检测到浏览器: {", ".join(b[0] for b in browsers)}')
    
    # 启动第一个可用的浏览器
    started = False
    for name, path in browsers:
        if start_browser(path, name):
            started = True
            break
    
    if not started:
        print('请手动启动浏览器并添加 --remote-debugging-port=' + str(CDP_PORT))
        print('按回车继续启动代理服务器...')
        input()
    
    # 启动 Node.js 代理
    script_dir = os.path.dirname(os.path.abspath(__file__))
    proxy_script = os.path.join(script_dir, 'cdp-proxy-server.cjs')
    
    print(f'\n启动 CDP 代理服务器 (端口 {PROXY_PORT})...')
    subprocess.Popen(['node', proxy_script], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    time.sleep(2)
    
    try:
        import urllib.request
        resp = urllib.request.urlopen(f'http://localhost:{PROXY_PORT}/health', timeout=3)
        print('✓ CDP 代理服务器已启动')
        print(f'\n  网站前端将自动调用 http://localhost:{PROXY_PORT}/scrape')
        print('  按 Ctrl+C 停止服务')
        print()
    except:
        print('⚠ 代理服务器可能未正常启动，请检查 Node.js 和 ws 模块是否已安装')
    
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        print('\n已停止')

if __name__ == '__main__':
    main()
