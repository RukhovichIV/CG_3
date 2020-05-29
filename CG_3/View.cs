using OpenTK;
using OpenTK.Graphics.OpenGL;
using System;

namespace CG_3
{
    class View
    {
        public static int BasicProgramID;

        public static void InitShaders()
        {
            int MyVertexShader, MyFragmentShader;
            BasicProgramID = GL.CreateProgram();
            LoadShader("..\\..\\raytracing.vert", ShaderType.VertexShader, BasicProgramID, out MyVertexShader);
            LoadShader("..\\..\\raytracing.frag", ShaderType.FragmentShader, BasicProgramID, out MyFragmentShader);
            GL.LinkProgram(BasicProgramID);
            int status = 0;
            GL.GetProgram(BasicProgramID, GetProgramParameterName.LinkStatus, out status);
            Console.WriteLine(GL.GetProgramInfoLog(BasicProgramID) + "Status: " + status.ToString());
        }

        public static void LoadShader(String filename, ShaderType type, int program, out int address)
        {
            address = GL.CreateShader(type);
            using (System.IO.StreamReader reader = new System.IO.StreamReader(filename))
            {
                GL.ShaderSource(address, reader.ReadToEnd());
            }
            GL.CompileShader(address);
            GL.AttachShader(program, address);
            Console.WriteLine(GL.GetShaderInfoLog(address));
        }

        public static void DrawQuad()
        {
            int VBOPos, AttrVpos = 0;
            Vector3[] VertData = new Vector3[]
            {
                new Vector3(-1f, -1f, 0f),
                new Vector3(1f, -1f, 0f),
                new Vector3(1f, 1f, 0f),
                new Vector3(-1f, 1f, 0f)
            };
            GL.GenBuffers(1, out VBOPos);
            GL.BindBuffer(BufferTarget.ArrayBuffer, VBOPos);
            GL.BufferData<Vector3>(BufferTarget.ArrayBuffer,
                (IntPtr)(VertData.Length * Vector3.SizeInBytes),
                VertData, BufferUsageHint.StaticDraw);
            GL.VertexAttribPointer(AttrVpos, 3, VertexAttribPointerType.Float, false, 0, 0);
            GL.EnableVertexAttribArray(AttrVpos);
            GL.UseProgram(BasicProgramID);
            GL.DrawArrays(BeginMode.Quads, 0, 4);
            GL.BindBuffer(BufferTarget.ArrayBuffer, 0);
        }

        public static void Update()
        {
            GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);
            DrawQuad();
        }
    }
}
