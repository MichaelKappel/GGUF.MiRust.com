using TinyRustLM;

if (args.Length == 0)
{
    Console.Error.WriteLine("Usage: TinyRustLM.ConsoleSample <model.slm> [prompt]");
    return 2;
}

var modelPath = args[0];
var prompt = args.Length > 1 ? args[1] : "hello";
var inspector = new TinySlmInspector();
var inspection = inspector.Inspect(modelPath);
Console.WriteLine($"model: {inspection.Sha256} {inspection.ByteCount} bytes {inspection.Quantization}");

var factory = new TinyRustLmRuntimeFactory();
using var runtime = factory.CreateRuntime();
runtime.LoadModel(modelPath, inspection.Sha256);
var result = runtime.Generate(prompt, new TinyRustLmGenerationOptions(MaxNewTokens: 16));
Console.WriteLine(result.Text);
return 0;
