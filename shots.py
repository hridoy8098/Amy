import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = await ctx.new_page()

        # 1. Login page
        await page.goto(BASE + "/login", wait_until="networkidle")
        await page.screenshot(path="screenshots/01-login.png")

        # 2. Fill demo credentials and submit
        await page.fill('input[type="email"]', "demo@amy.ai")
        await page.fill('input[type="password"]', "demo1234")
        await page.click('button[type="submit"], .btn-primary')
        await page.wait_for_url("**/dashboard**", timeout=15000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path="screenshots/02-dashboard.png")

        # 3. Courses
        await page.goto(BASE + "/courses", wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.screenshot(path="screenshots/03-courses.png")

        # 4. Course detail (paid -> shows payment CTA)
        await page.goto(BASE + "/courses/4", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="screenshots/04-course-detail.png")

        # 5. Amy chat with streaming reply
        await page.goto(BASE + "/amy", wait_until="networkidle")
        inp = page.locator("textarea, input.chat-input").first
        await inp.fill("Explain Newton's second law simply")
        await inp.press("Enter")
        await page.wait_for_timeout(6000)
        await page.screenshot(path="screenshots/05-amy-chat.png")

        # 6. Payment page
        await page.goto(BASE + "/payment?course_id=4", wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.screenshot(path="screenshots/06-payment.png")

        # 7. Progress charts
        await page.goto(BASE + "/progress", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="screenshots/07-progress.png")

        # 8. Profile
        await page.goto(BASE + "/profile", wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.screenshot(path="screenshots/08-profile.png")

        # 9. Admin analytics (login as admin in a fresh context)
        ctx2 = await browser.new_context(viewport={"width": 1280, "height": 800})
        pg2 = await ctx2.new_page()
        await pg2.goto(BASE + "/login", wait_until="networkidle")
        await pg2.fill('input[type="email"]', "admin@amy.ai")
        await pg2.fill('input[type="password"]', "admin1234")
        await pg2.click('button[type="submit"], .btn-primary')
        await pg2.wait_for_url("**/dashboard**", timeout=15000)
        await pg2.goto(BASE + "/admin/analytics", wait_until="networkidle")
        await pg2.wait_for_timeout(1500)
        await pg2.screenshot(path="screenshots/09-admin-analytics.png")

        await browser.close()
        print("ALL SHOTS OK")

asyncio.run(main())
