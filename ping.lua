local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local API = "URL_SAITAA"
local KEY = "KEY-123"

local Player = Players.LocalPlayer

local USER_ID = tostring(Player.UserId)
local USER_NAME = Player.Name
local DISPLAY_NAME = Player.DisplayName

task.spawn(function()
    while true do
        local success, err = pcall(function()
            local URL = API .. "/ping"
                .. "?key=" .. HttpService:UrlEncode(KEY)
                .. "&user=" .. HttpService:UrlEncode(USER_ID)
                .. "&id=" .. HttpService:UrlEncode(USER_ID)
                .. "&name=" .. HttpService:UrlEncode(USER_NAME)
                .. "&displayName=" .. HttpService:UrlEncode(DISPLAY_NAME)

            game:HttpGet(URL)
        end)

        if not success then
            warn("Heartbeat error:", err)
        end

        task.wait(5)
    end
end)
