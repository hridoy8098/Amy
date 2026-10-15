import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = await ctx.new_page()
        await page.goto(BASE + "/login", wait_until="networkidle")
        await page.fill('input[type="email"]', "demo@amy.ai")
        await page.fill('input[type="password"]', "demo1234")
        await page.click('button[type="submit"], .btn-primary')
        await page.wait_for_url("**/dashboard**", timeout=15000)

        # Amy chat with streaming reply
        await page.goto(BASE + "/amy", wait_until="networkidle")
        inp = page.locator('input[placeholder*="Message"]').first
        await inp.click()
        await inp.type("Explain Newton's second law simply", delay=15)
        await inp.press("Enter")
        await page.wait_for_timeout(7000)
        await page.screenshot(path="screenshots/05-amy-chat.png")

        for url, name in [("/payment?course_id=4","06-payment"), ("/progress","07-progress"), ("/profile","08-profile")]:
            await page.goto(BASE + url, wait_until="networkidle")
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"screenshots/{name}.png")

        # Admin desktop
        ctx2 = await browser.new_context(viewport={"width": 1280, "height": 800})
        pg2 = await ctx2.new_page()
        await pg2.goto(BASE + "/login", wait_until="networkidle")
        await pg2.fill('input[type="email"]', "admin@amy.ai")
        await pg2.fill('input[type="password"]', "admin1234")
        await pg2.click('button[type="submit"], .btn-primary')
        await pg2.wait_for_url("**/dashboard**", timeout=15000)
        await pg2.goto(BASE + "/admin/analytics", wait_until="networkidle")
        await pg2.wait_for_timeout(2000)
        await pg2.screenshot(path="screenshots/09-admin-analytics.png")
        await browser.close()
        print("ALL SHOTS OK")

asyncio.run(main())
