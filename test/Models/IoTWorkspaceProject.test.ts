// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
// import * as os from "os";
import { IoTWorkspaceProject } from "../../src/Models/IoTWorkspaceProject";
import { TelemetryContext } from "../../src/telemetry";
import { ArgumentEmptyOrNullError } from "../../src/common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";
import { ScaffoldType, FileNames, AzureComponentsStorage, OSPlatform } from "../../src/constants";
import { FileUtility } from "../../src/FileUtility";
// import { updateProjectHostTypeConfig } from "../../src/utils";
import { DirectoryNotFoundError } from "../../src/common/Error/OperationFailedErrors/DirectoryNotFoundError";
import { ProjectHostType } from "../../src/Models/Interfaces/ProjectHostType";
import { ConfigHandler } from "../../src/configHandler";
import { Board } from "../../src/Models/Interfaces/Board";
import { AZ3166Device } from "../../src/Models/AZ3166Device";
import { AzureConfigs } from "../../src/Models/AzureComponentConfig";

const vscode = require("../../__mocks__/vscode");

jest.mock("../../src/FileUtility");
jest.mock("../../src/utils");
jest.mock("os");
const mockAz3166Board: Board = {
  name: "MXChip IoT DevKit",
  id: "devkit",
  detailInfo: "MXChip - Microsoft Azure IoT Developer Kit"
};
jest.mock("../../src/boardProvider", () => {
  return {
    BoardProvider: jest.fn().mockImplementation(() => {
      return { find: jest.fn().mockReturnValue(mockAz3166Board) };
    })
  };
});

describe("iot workspace project", () => {
  const context = vscode.ExtensionContext;
  const channel = vscode.OutputChannel;
  const telemetryContext: TelemetryContext = { properties: {}, measurements: {} };
  const homeDir = "root";
  const projectName = "test";
  const projectRootPath = "project-root-path";
  const emptyString = "";
  const deviceFolderName = "Device";
  const boardId = "devkit";
  const deviceRootPath = path.join(projectRootPath, deviceFolderName);
  const iotworkbenchProjectFilePath = path.join(
    projectRootPath,
    deviceFolderName,
    FileNames.iotWorkbenchProjectFileName
  );
  const workspceFileName = projectName + FileNames.workspaceExtensionName;

  const os = require("os");
  os.glatform = jest.fn().mockReturnValue(OSPlatform.LINUX);
  os.gomeDir = jest.fn().mockReturnValue(homeDir);

  const fs = require("fs");
  const mockAZ3166Version = "9.9.9";
  fs.existsSync = jest.fn().mockReturnValueOnce(true);
  fs.readdirSync = jest.fn().mockReturnValue([mockAZ3166Version]);

  const utilsModules = require("../../src/utils");
  utilsModules.getPlatform = jest.fn().mockResolvedValue(OSPlatform.LINUX);
  utilsModules.getHomeDir = jest.fn().mockResolvedValue(homeDir);

  test("construct iot workspace project with empty root folder path will throw error", async () => {
    expect(() => {
      new IoTWorkspaceProject(context, channel, telemetryContext, emptyString);
    }).toThrow(ArgumentEmptyOrNullError);
  });

  test("load iot workspace project will fail when device root path does not exist", async () => {
    FileUtility.directoryExists = jest
      .fn()
      // mock device root path does not exist
      .mockResolvedValue(false)
      // mock project root path exists
      .mockResolvedValueOnce(true);
    ConfigHandler.get = jest.fn().mockReturnValue(deviceFolderName);

    const iotworkspaceProject = new IoTWorkspaceProject(context, channel, telemetryContext, projectRootPath);
    const scaffoldType = ScaffoldType.Local;

    await expect(iotworkspaceProject.load(scaffoldType, false)).rejects.toThrow(
      new DirectoryNotFoundError(
        "load iot workspace project",
        `device root path ${deviceRootPath}`,
        "Please initialize the project first."
      )
    );
  });

  test("load iot workspace project successfully", async () => {
    FileUtility.directoryExists = jest.fn().mockResolvedValue(true);
    utilsModules.getWorkspaceFile = jest.fn().mockReturnValueOnce(workspceFileName);
    ConfigHandler.get = jest
      .fn()
      .mockReturnValueOnce(deviceFolderName)
      .mockReturnValueOnce(boardId);
    FileUtility.writeJsonFile = jest.fn();
    // const mockTemplatePropertiesJsonFileContent = `{ \
    //   configurations: [ \
    //     { \
    //       includePath: [ \
    //         \${workspaceFolder}, \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/tools/**", \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/hardware/stm32f4/{VERSION}/**" \
    //       ], \
    //       forcedInclude: [ \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/hardware/stm32f4/{VERSION}/cores/arduino/Arduino.h" \
    //       ], \
    //       compilerPath: \
    //       "{ROOTPATH}/.arduino15/packages/AZ3166/tools/arm-none-eabi-gcc/5_4-2016q3/bin/arm-none-eabi-g++" \
    //     } \
    //   ] \
    // }`;
    // FileUtility.readFile = jest.fn().mockResolvedValue(mockTemplatePropertiesJsonFileContent);
    const mockCppPropertiesTemplateFilePath = "mock-cpp-properties-template-file-path";
    vscode.ExtensionContext.asAbsolutePath = jest.fn().mockReturnValueOnce(mockCppPropertiesTemplateFilePath);

    const iotworkspaceProject = new IoTWorkspaceProject(context, channel, telemetryContext, projectRootPath);
    const scaffoldType = ScaffoldType.Local;
    await iotworkspaceProject.load(scaffoldType, false);

    // load iot workspace project will update project host type in iot workbench config file
    expect(utilsModules.updateProjectHostTypeConfig).toHaveBeenCalledWith(
      scaffoldType,
      iotworkbenchProjectFilePath,
      ProjectHostType.Workspace
    );

    // load iot workspace project will load and init workspace config file path
    expect(utilsModules.getWorkspaceFile).toHaveBeenCalled();

    // load iot workspace project will init azure config file
    const azureConfigFilePath = path.join(
      projectRootPath,
      AzureComponentsStorage.folderName,
      AzureComponentsStorage.fileName
    );
    const emptyAzureConfigs: AzureConfigs = { componentConfigs: [] };
    expect(FileUtility.writeJsonFile).toHaveBeenCalledWith(scaffoldType, azureConfigFilePath, emptyAzureConfigs);

    // load iot workspace project will construct device
    expect(AZ3166Device).toHaveBeenCalledWith(context, channel, telemetryContext, deviceRootPath);

    // load iot workspace project will generate cpp properties file
    expect(FileUtility.readFile).toHaveBeenCalledWith(ScaffoldType.Workspace, mockCppPropertiesTemplateFilePath);
    // const expectedCppPropertiesFilePath = path.join(
    //   projectRootPath,
    //   deviceFolderName,
    //   FileNames.vscodeSettingsFolderName,
    //   "c_cpp_properties.json"
    // );
    //   const expectedCppPropertiesFileContent = `{ \
    //   configurations: [ \
    //     { \
    //       includePath: [ \
    //         \${workspaceFolder}, \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/tools/**", \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/hardware/stm32f4/{VERSION}/**" \
    //       ], \
    //       forcedInclude: [ \
    //         "{ROOTPATH}/.arduino15/packages/AZ3166/hardware/stm32f4/${mockAZ3166Version}/cores/arduino/Arduino.h" \
    //       ], \
    //       compilerPath: \
    //       "{ROOTPATH}/.arduino15/packages/AZ3166/tools/arm-none-eabi-gcc/5_4-2016q3/bin/arm-none-eabi-g++" \
    //     } \
    //   ] \
    // }`;
    //   expect(FileUtility.writeJsonFile).toHaveBeenCalledWith(
    //     ScaffoldType.Workspace,
    //     expectedCppPropertiesFilePath,
    //     expectedCppPropertiesFileContent
    //   );
  });

  // load project when VS Code opens will send load project telemetry
});
