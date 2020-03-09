// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as utils from "../src/utils";
import { FileNames, ScaffoldType } from "../src/constants";
import { ProjectHostType } from "../src/Models/Interfaces/ProjectHostType";
import { FileUtility } from "../src/FileUtility";

jest.mock("../src/FileUtility");

describe("utils", () => {
  test("Update project host type config successfully when iot workbench project file does not exist", async () => {
    const scaffoldType = ScaffoldType.Workspace;
    const projectHostType = ProjectHostType.Workspace;
    const iotWorkbenchProjectPath = `test.${FileNames.iotWorkbenchProjectFileName}`;
    FileUtility.fileExists = jest.fn().mockResolvedValueOnce(false);

    await utils.updateProjectHostTypeConfig(scaffoldType, iotWorkbenchProjectPath, projectHostType);

    const expectedProjectConfig = {
      ProjectHostType: projectHostType,
      version: "1.0.0"
    };
    expect(FileUtility.writeJsonFile).toHaveBeenCalledWith(
      scaffoldType,
      iotWorkbenchProjectPath,
      expectedProjectConfig
    );
  });
});
