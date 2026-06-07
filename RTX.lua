local shaderName = "RTX"

function onCreatePost()
    -- Initialize the shader on the main game camera
    initLuaShader(shaderName)
    
    setSpriteShader("camGame", shaderName)
    
    -- Set default uniform parameters
    setShaderBool("camGame", "u_Enable_SSR", true)
    setShaderBool("camGame", "u_Enable_SSS", true)
    setShaderBool("camGame", "u_Enable_AO", true)
    
    setShaderFloat("camGame", "u_Exposure", 1.1)
    setShaderFloat("camGame", "u_Saturation", 1.15)
    setShaderFloat("camGame", "u_Contrast", 1.05)
    setShaderFloat("camGame", "u_SSR_Intensity", 0.45)
    setShaderFloat("camGame", "u_SSS_Strength", 0.3)
end

function onUpdate(elapsed)
    -- Keep time updating so any continuous noise calculations run smoothly
    setShaderFloat("camGame", "iTime", os.clock())
end
