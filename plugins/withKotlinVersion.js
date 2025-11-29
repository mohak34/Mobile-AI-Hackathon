const { withProjectBuildGradle, withGradleProperties } = require('@expo/config-plugins');

function withKotlinVersion(config) {
  // Add gradle property to suppress Kotlin version check
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'kotlin.suppressGradlePluginWarnings',
      value: 'true',
    });
    return config;
  });

  // Modify build.gradle to add compose compiler arg
  config = withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    
    // Add suppressKotlinVersionCompatibilityCheck to all projects
    if (!contents.includes('suppressKotlinVersionCompatibilityCheck')) {
      config.modResults.contents = contents.replace(
        /allprojects\s*\{/,
        `allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += ["-P", "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=1.9.25"]
        }
    }`
      );
    }
    return config;
  });

  return config;
}

module.exports = withKotlinVersion;
