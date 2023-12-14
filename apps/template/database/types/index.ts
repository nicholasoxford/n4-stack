export type Meme = {
  id: number;
  name: string;
  url: string;
  user_id: number;
  width: number;
  height: number;
  created_at: string; // Assuming you store the DATETIME as a string
  updated_at: string; // Assuming you store the DATETIME as a string
};
